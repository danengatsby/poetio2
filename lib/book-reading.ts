export const readingPositionKey = (fileId: string) => `poetio:book-position:v1:${fileId}`;

export function restoredPage(value: string | null, total: number) {
  if (!value || !Number.isSafeInteger(total) || total < 1) return 1;
  try {
    const bookmark = JSON.parse(value);
    return Number.isSafeInteger(bookmark?.page) && bookmark.page > 0 ? Math.min(bookmark.page, total) : 1;
  } catch { return 1; }
}

export function readingPages(page: number, total: number, single: boolean) {
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(total) || page < 1 || page > total) return [];
  const first = single ? page : page - (page - 1) % 2;
  return single || first === total ? [first] : [first, first + 1];
}
