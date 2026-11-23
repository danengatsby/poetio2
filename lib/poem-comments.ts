import { pick } from './site-language';
import type { SiteLanguage } from './poem-types';
export function commentCountLabel(count: number, language: SiteLanguage) {
  return pick(
    language,
    `${count} ${count === 1 ? 'comentariu' : 'comentarii'}`,
    `${count} ${count === 1 ? 'comment' : 'comments'}`,
    `${count} ${count > 1 ? 'commentaires' : 'commentaire'}`,
    `${count} ${count === 1 ? 'Kommentar' : 'Kommentare'}`,
    `${count} ${count === 1 ? 'comentario' : 'comentarios'}`,
    `${count} ${count === 1 ? 'commento' : 'commenti'}`,
  );
}

export const COMMENT_NAME_LIMIT = 80;
export const COMMENT_BODY_LIMIT = 2000;
export type ReaderComment = { id: string; name: string; content: string; created_at: number };
export type PoemComment = ReaderComment & { poem_id: string };
