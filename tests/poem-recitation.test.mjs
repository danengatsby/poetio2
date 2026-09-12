import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'poetio-recitation-'));
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
writeFileSync(join(output, 'recitation.cjs'), ts.transpileModule(readFileSync(new URL('../lib/poem-recitation.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
process.on('exit', () => rmSync(output, {recursive: true, force: true}));
const { speechSegments, languageVoices, PoemRecitation } = createRequire(import.meta.url)(join(output, 'recitation.cjs'));
const voice = { name: 'Voce română', voiceURI: 'ro-test', lang: 'ro-RO', default: false };

function session(t, segments = speechSegments('Titlu', 'Primul vers\n\nUltimul vers')) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const spoken = [], changes = [];
  let cancellations = 0;
  const synth = { speak: utterance => spoken.push(utterance), cancel: () => { cancellations++; spoken.at(-1)?.onerror?.({error: 'canceled'}); } };
  const reader = new PoemRecitation(synth, text => ({text}), segments, 'ro-RO', value => changes.push(value));
  t.after(() => reader.dispose());
  return { reader, spoken, changes, cancellations: () => cancellations, state: () => changes.at(-1), tick: ms => t.mock.timers.tick(ms) };
}

test('long verses preserve all Unicode text and stanza pauses without oversized utterances', () => {
  const content = `  Început — ș, ț, ă, î, â.\n\n${'un cuvânt '.repeat(120)}\n${'🌙'.repeat(501)}\nSfârșit.`;
  const chunks = speechSegments('Un titlu', content);
  assert.ok(chunks.every(chunk => Array.from(chunk.text).length <= 220 && chunk.text.trim()));
  assert.equal(chunks.map(chunk => chunk.text).join('').replace(/\s/g, ''), ('Un titlu' + content).replace(/\s/g, ''));
  assert.equal(chunks[1].pauseAfter, 650);
  assert.equal(chunks[0].pauseAfter, 500);
});

test('voice matching prefers American English and never selects a different language', () => {
  const british = {name: 'British', lang: 'en-GB', default: true};
  const american = {name: 'American', lang: 'en_US', default: false};
  assert.deepEqual(languageVoices([british, voice, american], 'en-US'), [american, british]);
  assert.deepEqual(languageVoices([british, voice], 'ro-RO'), [voice]);
  assert.deepEqual(languageVoices([british], 'ro-RO'), []);
});

test('recitation starts only on request and reads every segment in order with the selected settings', t => {
  const s = session(t);
  assert.equal(s.spoken.length, 0);
  s.reader.play(voice, 0.75);
  s.reader.play(voice, 1);
  for (let index = 0; index < 3; index++) {
    const utterance = s.spoken[index];
    assert.equal(utterance.voice, voice);
    assert.equal(utterance.lang, 'ro-RO');
    assert.equal(utterance.rate, 0.75);
    utterance.onstart();
    utterance.onend();
    s.tick(1000);
  }
  assert.deepEqual(s.spoken.map(item => item.text), ['Titlu', 'Primul vers', 'Ultimul vers']);
  assert.deepEqual(s.state(), {status: 'ended', completed: 3});
  s.reader.play(voice, 1);
  assert.equal(s.spoken.at(-1).text, 'Titlu');
  assert.deepEqual(s.state(), {status: 'playing', completed: 0});
});

test('pause cancels speech, resumes the interrupted passage and ignores late canceled events', t => {
  const s = session(t);
  s.reader.play(voice, 0.9);
  const lateEnd = s.spoken[0].onend, lateError = s.spoken[0].onerror;
  s.reader.pause();
  assert.equal(s.cancellations(), 1);
  assert.deepEqual(s.state(), {status: 'paused', completed: 0});
  s.reader.play(voice, 0.9);
  lateEnd(); lateError(); s.tick(1000);
  assert.equal(s.spoken.length, 2);
  assert.equal(s.spoken[1].text, 'Titlu');
  assert.deepEqual(s.state(), {status: 'playing', completed: 0});
  s.reader.stop();
  assert.deepEqual(s.state(), {status: 'idle', completed: 0});
});

test('pause between verses prevents the pending verse from starting', t => {
  const s = session(t);
  s.reader.play(voice, 0.9);
  s.spoken[0].onend();
  s.reader.pause(); s.tick(2000);
  assert.equal(s.spoken.length, 1);
  s.reader.play(voice, 0.9);
  assert.equal(s.spoken[1].text, 'Primul vers');
});

test('closing or replacing a player cancels its speech and pending timers without late updates', t => {
  const s = session(t);
  s.reader.play(voice, 0.9);
  const lateEnd = s.spoken[0].onend;
  s.reader.dispose();
  lateEnd(); s.tick(20000); s.reader.play(voice, 1);
  assert.equal(s.cancellations(), 1);
  assert.equal(s.spoken.length, 1);
  assert.equal(s.changes.length, 1);
});

test('silent startup and engine failures exit playback and allow retry', t => {
  const s = session(t);
  s.reader.play(voice, 0.9);
  s.tick(15000);
  assert.equal(s.state().status, 'error');
  s.reader.play(voice, 0.9);
  s.spoken[1].onstart(); s.tick(20000);
  assert.equal(s.state().status, 'playing');
  s.spoken[1].onerror({error: 'synthesis-failed'});
  assert.equal(s.state().status, 'error');
  s.reader.play(voice, 0.9);
  assert.equal(s.spoken[2].text, 'Titlu');
});
