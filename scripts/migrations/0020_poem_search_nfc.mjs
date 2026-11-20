// After 0020: index every poem again with NFC-normalized search text.
import { tsImport } from 'tsx/esm/api';
import { openDatabase } from '../../server/vps-storage.mjs';

export default async function rebuildPoemSearch(file) {
  const { rebuildPendingPoemSearch } = await tsImport('../../db/poem-search-index.ts', import.meta.url);
  const store = openDatabase(file);
  try {
    await rebuildPendingPoemSearch(store, true);
  } finally {
    store.close();
  }
}
