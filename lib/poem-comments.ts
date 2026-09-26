export function commentCountLabel(count: number, language: 'ro' | 'en-US') {
  return language === 'ro' ? `${count} ${count === 1 ? 'comentariu' : 'comentarii'}` : `${count} ${count === 1 ? 'comment' : 'comments'}`;
}

export const COMMENT_NAME_LIMIT = 80;
export const COMMENT_BODY_LIMIT = 2000;
export type ReaderComment = { id: string; name: string; content: string; created_at: number };
export type PoemComment = ReaderComment & { poem_id: string };
