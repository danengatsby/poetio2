export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_ACCEPT = '.mp4,.webm,video/mp4,video/webm';
export type Video = { id: string; title: string; author: string; description: string; file_id: string; revision: number; created_at: number; updated_at: number };
export type VideoWithCommentCount = Video & { comment_count: number };
export type VideoInput = Pick<Video, 'title' | 'author' | 'description' | 'file_id'>;
// A still frame generated on the server; see db/video-posters.ts.
export const videoPosterPath = (fileId: string) => `/api/video-posters/${fileId}`;
export function videoFileType(file: Pick<File, 'name'>): string | null {
  return ({ mp4: 'video/mp4', webm: 'video/webm' } as Record<string, string>)[file.name.split('.').pop()?.toLowerCase() || ''] || null;
}
