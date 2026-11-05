import test from 'node:test';
import assert from 'node:assert/strict';
import { backupStatus, openOperations } from '../server/operations.mjs';

const now = Date.parse('2026-09-27T20:00:00Z');
const sample = () => ({ sampledAt: new Date(now).toISOString(), backup: { verified: true, createdAt: '2026-09-27T03:15:00Z', archive: 'poetio-20260927T031500Z.tar.gz.gpg', bytes: 500 }, lastAttempt: 'success', scheduled: true });
test('backup freshness separates restoration proof, collection health, schedule and failed attempts', () => {
  assert.equal(backupStatus(sample(), now).state, 'ok');
  const old = sample(); old.backup.createdAt = '2026-09-25T03:15:00Z';
  assert.equal(backupStatus(old, now).state, 'overdue');
  const failed = { ...sample(), lastAttempt: 'failed', scheduled: false };
  const value = backupStatus(failed, now);
  assert.equal(value.lastAttempt, 'failed'); assert.equal(value.scheduled, false); assert.ok(value.verified);
  for (const raw of [null, {}, { ...sample(), sampledAt: 'bad' }, { ...sample(), sampledAt: '2026-09-27T19:54:00Z' }, { ...sample(), sampledAt: '2027-01-01T00:00:00Z' }]) {
    assert.equal(backupStatus(raw, now).state, 'unknown'); assert.equal(backupStatus(raw, now).lastAttempt, 'unknown');
  }
  for (const changes of [{ verified: false }, { archive: '../../etc/password' }, { bytes: -3 }, { createdAt: '2027-01-01T00:00:00Z' }]) {
    assert.equal(backupStatus({ ...sample(), backup: { ...sample().backup, ...changes } }, now).state, 'missing');
  }
});
test('operations exposes bounded sanitized media errors without swallowing rendering failures', async () => {
  const monitor = openOperations('/unused', { now: () => now, read: async () => JSON.stringify({ ...sample(), secret: 'PRIVATE_KEY' }), disk: async () => ({ bavail: 1, blocks: 100, bsize: 4096 }) });
  const failure = Object.assign(new Error('SECRET_RAW_ERROR'), { code: 'invalid' });
  const renderer = monitor.observe('book', { info: async () => { throw failure; }, validation: async () => ({ status: 'error', code: 'encrypted' }), page: async () => Buffer.from('ok') });
  const file = { id: '12345678-1234-1234-1234-123456789abc', content: 'PRIVATE_BODY' };
  await assert.rejects(renderer.info(file), error => error === failure);
  await assert.rejects(renderer.info(file));
  assert.equal((await renderer.page(file)).toString(), 'ok');
  await renderer.validation(file);
  let snapshot = await monitor.snapshot();
  assert.equal(snapshot.media.length, 2); assert.equal(snapshot.media[1].count, 2); assert.equal(snapshot.disk.state, 'low');
  assert.equal(/PRIVATE|SECRET/.test(JSON.stringify(snapshot)), false);
  for (let i = 0; i < 35; i++) await renderer.validation({ id: `${String(i).padStart(8, '0')}-1234-1234-1234-123456789abc` });
  snapshot = await monitor.snapshot(); assert.equal(snapshot.media.length, 20);
  snapshot.media[0].count = 900; assert.equal((await monitor.snapshot()).media[0].count, 1);
});
test('missing and corrupt status or filesystem errors cannot appear healthy', async () => {
  for (const read of [async () => { throw new Error('permission'); }, async () => '{', async () => ' '.repeat(17000)]) {
    const state = await openOperations('/unused', { now: () => now, read, disk: async () => { throw new Error('not available'); } }).snapshot();
    assert.equal(state.backup.state, 'unknown'); assert.equal(state.disk.state, 'unknown');
  }
});
