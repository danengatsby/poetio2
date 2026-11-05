import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../lib/poem-reading.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { restoredPoemReading, poemReadingKey } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('poem reading settings reject malformed storage, arbitrary widths and unsupported sizes', () => {
  const defaults = { textSize: 1.125, width: 'normal' };
  for (const value of [null, '', '{', 'null', '[]', 'true', '1', '"wide"', '{}']) assert.deepEqual(restoredPoemReading(value), defaults);
  for (const textSize of [null, '1.5', true, -1, 0, .875, 1.1, 2.125, 1e300]) assert.deepEqual(restoredPoemReading(JSON.stringify({ width: 'wide', textSize })), { textSize: 1.125, width: 'wide' });
  assert.deepEqual(restoredPoemReading('{"width":"100000px","textSize":1.5}'), { width: 'normal', textSize: 1.5 });
  assert.notEqual(poemReadingKey, 'poetio:book-preferences:v1');
  for (const width of ['narrow', 'normal', 'wide']) for (let textSize = 1; textSize <= 2; textSize += .125) assert.deepEqual(restoredPoemReading(JSON.stringify({ width, textSize })), { width, textSize });
});
