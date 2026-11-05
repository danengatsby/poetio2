export const readingPositionKey = (fileId: string) => `poetio:book-position:v1:${fileId}`;

export const readingPreferencesKey = 'poetio:book-preferences:v1';
export const bookTextSize = { min: 1, max: 2.5, step: .25 } as const;
export type ReadingPreferences = { mode: 'original' | 'text'; textSize: number };
export const defaultReadingPreferences: Readonly<ReadingPreferences> = Object.freeze({ mode: 'original', textSize: 1.25 });

export function restoredReadingPreferences(value: string | null): ReadingPreferences {
  try {
    const saved = value ? JSON.parse(value) : null;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...defaultReadingPreferences };
    return {
      mode: saved.mode === 'text' || saved.mode === 'original' ? saved.mode : defaultReadingPreferences.mode,
      textSize: typeof saved.textSize === 'number' && Number.isFinite(saved.textSize) && saved.textSize >= bookTextSize.min && saved.textSize <= bookTextSize.max && Number.isInteger(saved.textSize / bookTextSize.step) ? saved.textSize : defaultReadingPreferences.textSize,
    };
  } catch { return { ...defaultReadingPreferences }; }
}

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
