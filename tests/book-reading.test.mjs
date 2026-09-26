import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../lib/book-reading.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readingPositionKey, restoredPage, readingPages } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('saved position validates malformed data, clamps to available pages and isolates PDF versions', () => {
  for (const value of [null, '', 'invalid', 'null', '[]', '{}', '{"page":0}', '{"page":-4}', '{"page":"7"}', '{"page":1.5}', '{"page":9007199254740992}']) assert.equal(restoredPage(value, 104), 1);
  assert.equal(restoredPage('{"page":12}', 104), 12);
  assert.equal(restoredPage('{"page":105}', 104), 104);
  assert.equal(restoredPage('{"page":12}', 0), 1);
  assert.notEqual(readingPositionKey('old-pdf'), readingPositionKey('new-pdf'));
});

test('single pages and spreads preserve the selected even page across layout changes', () => {
  assert.deepEqual(readingPages(12, 104, true), [12]);
  assert.deepEqual(readingPages(12, 104, false), [11, 12]);
  assert.deepEqual(readingPages(104, 104, true), [104]);
  assert.deepEqual(readingPages(104, 104, false), [103, 104]);
  assert.deepEqual(readingPages(103, 103, false), [103]);
  assert.deepEqual(readingPages(1, 1, false), [1]);
  for (const page of [0, -1, 1.5, 105]) assert.deepEqual(readingPages(page, 104, true), []);
});
