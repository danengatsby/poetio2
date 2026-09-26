import type { ReaderComment } from './poem-comments';

export const COMMENT_KINDS = ['poem', 'video', 'book', 'about'] as const;
export const COMMENT_STATUSES = ['pending', 'approved', 'hidden'] as const;
export type CommentKind = typeof COMMENT_KINDS[number];
export type CommentStatus = typeof COMMENT_STATUSES[number];
export type ModeratedComment = ReaderComment & {
  kind: CommentKind;
  parent_id: string | null;
  title: string;
  status: CommentStatus;
  revision: number;
  moderated_at: number | null;
};
export type ModerationPage = {
  comments: ModeratedComment[];
  total: number;
  hasMore: boolean;
  counts: Record<CommentStatus, number>;
};
export const kindLabels: Record<CommentKind, string> = { poem: 'Poeme', video: 'Video', book: 'Cărți', about: 'Despre Poetio' };
export const statusLabels: Record<CommentStatus, string> = { pending: 'În așteptare', approved: 'Publicate', hidden: 'Ascunse' };
