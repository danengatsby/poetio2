import { COMMENT_BODY_LIMIT, COMMENT_NAME_LIMIT } from './poem-comments';

export const COMMENT_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const commentDraftPrefix = 'poetio:comment-draft:v1:';
export type CommentAttempt = { id: string; name: string; content: string };
export type CommentDraft = { version: 1; name: string; content: string; attempt: CommentAttempt | null; savedAt: number };
export const commentDraftKey = (endpoint: string) => commentDraftPrefix + endpoint;
export function restoredCommentDraft(raw: string | null, now = Date.now()): CommentDraft | null {
  try {
    if (!raw || raw.length > 20000) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || typeof value.name !== 'string' || value.name.length > COMMENT_NAME_LIMIT || typeof value.content !== 'string' || value.content.length > COMMENT_BODY_LIMIT || !Number.isSafeInteger(value.savedAt) || value.savedAt > now + 60000 || now - value.savedAt >= COMMENT_DRAFT_TTL) return null;
    const attempt = value.attempt;
    return { version: 1, name: value.name, content: value.content, savedAt: value.savedAt, attempt: attempt && typeof attempt.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attempt.id) && attempt.name === value.name.trim() && attempt.content === value.content.trim() ? { id: attempt.id, name: attempt.name, content: attempt.content } : null };
  } catch { return null; }
}

export function saveCommentDraft(storage: Storage, key: string, draft: CommentDraft, now = Date.now()) {
  const entries: { key: string; savedAt: number }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const other = storage.key(index);
    if (!other?.startsWith(commentDraftPrefix) || other === key) continue;
    const value = restoredCommentDraft(storage.getItem(other), now);
    entries.push({ key: other, savedAt: value?.savedAt ?? 0 });
  }
  // Session-only, with an age and count bound for shared devices.
  entries.sort((a, b) => b.savedAt - a.savedAt).forEach((entry, index) => {
    if (!entry.savedAt || index >= 39) storage.removeItem(entry.key);
  });
  if (draft.name || draft.content) storage.setItem(key, JSON.stringify(draft));
  else storage.removeItem(key);
}
