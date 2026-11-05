import { MAX_PAGE_TEXT, type BookPageText } from './book-text';

export type BookTextSnapshot = { fileId: string; page: number; text: string; language: BookPageText['language']; revision: number };
export type LocalTextDraft = { version: 1; snapshot: BookTextSnapshot; savedAt: number; key: string };
export const textDraftPrefix = (fileId: string) => `poetio:book-text-draft:v1:${fileId}:`;
export function textSnapshot(value: unknown): BookTextSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.fileId !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.fileId) || !Number.isSafeInteger(data.page) || (data.page as number) < 1 || (data.page as number) > 2000 || typeof data.text !== 'string' || data.text.length > MAX_PAGE_TEXT || !['und', 'ro', 'en-US'].includes(data.language as string) || !Number.isSafeInteger(data.revision) || (data.revision as number) < 0) return null;
  return { fileId: data.fileId, page: data.page as number, text: data.text, language: data.language as BookPageText['language'], revision: data.revision as number };
}
export function localTextDrafts(storage: Storage, fileId: string): LocalTextDraft[] {
  const entries: LocalTextDraft[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(textDraftPrefix(fileId))) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw || raw.length > 400000) continue;
      const value = JSON.parse(raw), snapshot = textSnapshot(value.snapshot);
      if (value.version === 1 && snapshot?.fileId === fileId && Number.isSafeInteger(value.savedAt) && value.savedAt > 0) entries.push({ version: 1, snapshot, savedAt: value.savedAt, key });
    } catch { /* Ignore a malformed entry without hiding valid drafts. */ }
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt);
}
