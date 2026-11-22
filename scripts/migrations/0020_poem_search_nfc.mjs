// After 0020: index every poem again with NFC-normalized search text.
import { tsImport } from 'tsx/esm/api';
import { openDatabase } from '../../server/vps-storage.mjs';

export default async function rebuildPoemSearch(file) {
  const { rebuildPendingPoemSearch } = await tsImport('../../db/poem-search-index.ts', import.meta.url);
  const store = openDatabase(file);
  try {
    // The columns poem_search had at 0020; the French ones arrived with 0024.
    await rebuildPendingPoemSearch(store, true, [
      'title',
      'author',
      'theme',
      'content',
      'translated_title',
      'translated_theme',
      'translated_content',
    ]);
  } finally {
    store.close();
  }
}
