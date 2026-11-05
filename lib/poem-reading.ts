export type PoemReadingPreferences = { textSize: number; width: 'narrow' | 'normal' | 'wide' };
export const poemReadingKey = 'poetio:poem-reading:v1';
export const defaultPoemReading: Readonly<PoemReadingPreferences> = Object.freeze({ textSize: 1.125, width: 'normal' });
export function restoredPoemReading(value: string | null): PoemReadingPreferences {
  try {
    const saved = value ? JSON.parse(value) : null;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...defaultPoemReading };
    return {
      textSize: typeof saved.textSize === 'number' && Number.isFinite(saved.textSize) && saved.textSize >= 1 && saved.textSize <= 2 && Number.isInteger(saved.textSize * 8) ? saved.textSize : defaultPoemReading.textSize,
      width: ['narrow', 'normal', 'wide'].includes(saved.width) ? saved.width : defaultPoemReading.width,
    };
  } catch { return { ...defaultPoemReading }; }
}
