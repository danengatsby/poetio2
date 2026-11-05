export type OperationsSnapshot = {
  available: true; sampledAt: string;
  backup: { state: 'ok' | 'overdue' | 'missing' | 'unknown'; sampledAt: string | null; verified: { createdAt: string; archive: string; bytes: number } | null; lastAttempt: 'success' | 'failed' | 'running' | 'unknown'; scheduled: boolean | null };
  disk: { state: 'ok' | 'low' | 'unknown'; free: number | null; total: number | null };
  runtime: { release: string; startedAt: string; node: string };
  media: { kind: 'book' | 'image' | 'media'; operation: string; fileId: string | null; code: string; count: number; at: string }[];
};
export type OperationsResult = OperationsSnapshot | { available: false };
