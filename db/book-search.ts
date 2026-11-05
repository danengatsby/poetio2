import { AppError } from '../lib/access';
import { foldSearch, searchPredicate } from '../lib/poem-search';
import { textMatch, type BookSearchResult } from '../lib/book-text';
import { readBookText, type TextRenderer } from './book-text';
import type { StoredBookFile } from './book-files';
import type { Database } from './poems';

type State = Pick<BookSearchResult, 'pages' | 'scanned' | 'status'>;
export type BookSearchService = { search(file: StoredBookFile, query: string, offset?: number, retry?: boolean): Promise<BookSearchResult> };
const PAGE_SIZE = 20;

export function createBookSearch(db: Database, renderer: TextRenderer) {
  // One background book at a time. Checkpoints survive restarts; repeated
  // searches share the same work and never fetch every page in the browser.
  const running = new Map<string, Promise<void>>();
  const state = (id: string) => db.prepare('SELECT pages, scanned, status FROM book_search_state WHERE file_id = ?').bind(id).first<State>();

  async function prepare(file: StoredBookFile, initial: State) {
    try {
      for (let page = initial.scanned + 1; page <= initial.pages; page++) {
        const existing = await db.prepare('SELECT page FROM book_search_pages WHERE file_id = ? AND page = ?').bind(file.id, page).first();
        if (!existing) {
          let content = '', source = 'missing', revision = 0;
          try {
            const result = await readBookText(db, file, page, renderer);
            content = result.text; source = result.text.trim() ? result.source : 'missing'; revision = result.revision;
          } catch { /* Missing pages remain explicit and can be retried. */ }
          // A correction committed while extraction was running always wins.
          await db.prepare(`INSERT INTO book_search_pages (file_id, page, content, search_text, source, revision) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_id, page) DO NOTHING`).bind(file.id, page, content, foldSearch(content), source, revision).run();
        }
        await db.prepare(`UPDATE book_search_state SET scanned = ?, status = ?, updated_at = ? WHERE file_id = ?`)
          .bind(page, page === initial.pages ? 'ready' : 'preparing', Date.now(), file.id).run();
        // Also yield when every page was already cached.
        if (page % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch {
      await db.prepare("UPDATE book_search_state SET status = 'error', updated_at = ? WHERE file_id = ?").bind(Date.now(), file.id).run();
    }
  }

  async function search(file: StoredBookFile, value: string, offset = 0, retry = false): Promise<BookSearchResult> {
    const query = value.trim().normalize('NFC');
    if (Array.from(query).length < 2 || Array.from(query).length > 120 || query.includes('\0') || !Number.isSafeInteger(offset) || offset < 0 || offset > 2000) throw new AppError(400, 'Caută între 2 și 120 de caractere și alege o pagină validă de rezultate.');
    let progress = await state(file.id);
    if (!progress) {
      const { pages } = await renderer.info(file);
      if (!Number.isSafeInteger(pages) || pages < 1 || pages > 2000) throw new AppError(503, 'Căutarea cărții nu poate fi pregătită momentan.');
      await db.prepare('INSERT INTO book_search_state (file_id, pages, scanned, status, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(file_id) DO NOTHING')
        .bind(file.id, pages, 'preparing', Date.now()).run();
      progress = (await state(file.id))!;
    }
    if (retry && progress.status !== 'preparing' && !running.has(file.id)) {
      await db.batch([
        db.prepare("DELETE FROM book_search_pages WHERE file_id = ? AND source = 'missing'").bind(file.id),
        db.prepare("UPDATE book_search_state SET scanned = 0, status = 'preparing', updated_at = ? WHERE file_id = ?").bind(Date.now(), file.id),
      ]);
      progress = { ...progress, scanned: 0, status: 'preparing' };
    }
    if (progress.status === 'preparing' && running.size === 0) {
      const task = prepare(file, progress).catch(() => { /* A later poll resumes the durable checkpoint. */ }).finally(() => running.delete(file.id));
      running.set(file.id, task);
    }
    const predicate = searchPredicate('book_search_pages', ['search_text'], query);
    const where = `file_id = ? AND ${predicate.sql}`;
    const bindings = [file.id, ...predicate.bindings];
    const total = (await db.prepare(`SELECT COUNT(*) AS total FROM book_search_pages WHERE ${where}`).bind(...bindings).first<{ total: number }>())!.total;
    const { results } = await db.prepare(`SELECT page, content FROM book_search_pages WHERE ${where} ORDER BY page LIMIT ? OFFSET ?`)
      .bind(...bindings, PAGE_SIZE, offset).all<{ page: number; content: string }>();
    const unavailable = (await db.prepare("SELECT COUNT(*) AS n FROM book_search_pages WHERE file_id = ? AND source = 'missing'").bind(file.id).first<{ n: number }>())!.n;
    return { ...progress, unavailable, total, offset, hasMore: offset + results.length < total,
      results: results.map(row => {
        const index = textMatch(row.content, query), start = Math.max(0, index - 60), end = Math.min(row.content.length, index + query.length + 100);
        return { page: row.page, excerpt: `${start ? '…' : ''}${row.content.slice(start, end)}${end < row.content.length ? '…' : ''}` };
      }) };
  }
  return { search, async idle() { await Promise.all([...running.values()]); } };
}
