export type ContentKind = 'poem' | 'video';
export type EditorSnapshot = { id: string; title: string; revision: number; isNew: boolean; [key: string]: unknown };
export type RecoveryEntry = { id: string | number; entity_id: string; title: string; revision?: number; event?: string; created_at?: number; recorded_at?: number };
export type LocalDraft = { key: string; kind: ContentKind; snapshot: EditorSnapshot; savedAt: number; pendingFiles: boolean };
export const localDraftPrefix = (kind: ContentKind) => `poetio:editor-draft:v1:${kind}:`;
