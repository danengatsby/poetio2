import { readFile, statfs } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { basename } from 'node:path';

const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
export function backupStatus(raw, now = Date.now()) {
  const sampled = time(raw?.sampledAt), verified = time(raw?.backup?.createdAt);
  const fresh = Number.isFinite(sampled) && sampled <= now + 60000 && now - sampled <= 5 * 60000;
  const valid = raw?.backup?.verified === true && Number.isFinite(verified) && verified <= now + 60000 && /^poetio-\d{8}T\d{6}Z\.tar\.gz\.gpg$/.test(raw.backup.archive) && Number.isSafeInteger(raw.backup.bytes) && raw.backup.bytes > 0;
  const lastAttempt = ['success', 'failed', 'running', 'unknown'].includes(raw?.lastAttempt) ? raw.lastAttempt : 'unknown';
  const scheduled = typeof raw?.scheduled === 'boolean' ? raw.scheduled : null;
  return {
    state: !fresh ? 'unknown' : !valid ? 'missing' : now - verified > 36 * 3600000 ? 'overdue' : 'ok',
    sampledAt: Number.isFinite(sampled) ? new Date(sampled).toISOString() : null,
    verified: valid ? { createdAt: new Date(verified).toISOString(), archive: raw.backup.archive, bytes: raw.backup.bytes } : null,
    lastAttempt: fresh ? lastAttempt : 'unknown', scheduled: fresh ? scheduled : null,
  };
}

// Process-local and bounded: no file contents, user input or raw errors are retained.
export function openOperations(directory, { statusPath = process.env.POETIO_STATUS_FILE || '/run/poetio-status/status.json', now = Date.now, read = readFile, disk = statfs } = {}) {
  const startedAt = new Date(now() - Math.round(process.uptime() * 1000)).toISOString();
  const release = basename(realpathSync(process.cwd()));
  const errors = [];
  function record(kind, operation, file, error) {
    const fileId = /^[0-9a-f-]{36}$/i.test(file?.id) ? file.id : null;
    const code = ['invalid', 'encrypted', 'unsupported', 'limits', 'unavailable'].includes(error?.code) ? error.code : 'unavailable';
    const old = errors.find(item => item.kind === kind && item.operation === operation && item.fileId === fileId && item.code === code);
    if (old) { errors.splice(errors.indexOf(old), 1); old.count++; old.at = new Date(now()).toISOString(); errors.unshift(old); }
    else errors.unshift({ kind, operation, fileId, code, count: 1, at: new Date(now()).toISOString() });
    errors.length = Math.min(errors.length, 20);
  }
  /** @template {Record<string, Function>} T @param {string} kind @param {T} renderer @returns {T} */
  function observe(kind, renderer) {
    return /** @type {T} */ (Object.fromEntries(Object.entries(renderer).map(([operation, method]) => [operation, async (...args) => {
      try {
        const result = await method.apply(renderer, args);
        if (result?.status === 'error') record(kind, operation, args[0], result);
        return result;
      } catch (error) { record(kind, operation, args[0], error); throw error; }
    }])));
  }
  async function snapshot() {
    let backup = backupStatus(null, now()), space = { state: 'unknown', free: null, total: null };
    try { const raw = await read(statusPath, 'utf8'); if (raw.length <= 16384) backup = backupStatus(JSON.parse(raw), now()); } catch { /* Explicit unknown, never infer success. */ }
    try {
      const fs = await disk(directory), free = fs.bavail * fs.bsize, total = fs.blocks * fs.bsize;
      if (Number.isSafeInteger(free) && Number.isSafeInteger(total) && free >= 0 && total > 0) space = { state: free < 1024 ** 3 || free / total < .1 ? 'low' : 'ok', free, total };
    } catch { /* Keep unknown. */ }
    return { available: true, sampledAt: new Date(now()).toISOString(), backup, disk: space, runtime: { release, startedAt, node: process.version }, media: errors.map(item => ({ ...item })) };
  }
  return { snapshot, observe };
}
