import { DatabaseSync } from 'node:sqlite';
import { existsSync, createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

const runStatement = Symbol('runStatement');

/** D1's small prepared-statement interface, backed by persistent SQLite. */
export function openDatabase(file) {
  // Deployment imports the collection explicitly; never start with an empty DB.
  if (!existsSync(file)) throw new Error('Import the Poetio database before starting the server.');
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  sqlite.prepare('SELECT key FROM collection_meta LIMIT 1').all();
  return {
    prepare(query) {
      const statement = sqlite.prepare(query);
      let bindings = [];
      return {
        bind(...values) { bindings = values; return this; },
        // node:sqlite returns null-prototype records; React's RSC transport
        // requires ordinary objects, matching D1's JSON result objects.
        async first() { const row = statement.get(...bindings); return row ? { ...row } : null; },
        async all() { return { results: statement.all(...bindings).map(row => ({ ...row })) }; },
        async run() { return this[runStatement](); },
        [runStatement]() { return { meta: { changes: Number(statement.run(...bindings).changes) } }; },
      };
    },
    async batch(statements) {
      // No await inside the transaction: another request cannot interleave.
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement[runStatement]());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() { sqlite.close(); },
  };
}

/** R2's used operations, with atomic writes outside the public asset directory. */
export function openImageBucket(directory) {
  return openMediaBucket(directory, 'poem-images', 'image');
}

export function openAudioBucket(directory) {
  return openMediaBucket(directory, 'poem-audio', 'audio');
}

function openMediaBucket(directory, prefix, label) {
  function objectPath(key) {
    if (!new RegExp(`^${prefix}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{64}$`, 'i').test(key)) {
      throw new Error(`Invalid ${label} storage key.`);
    }
    return join(directory, key);
  }
  return {
    async put(key, bytes) {
      const target = objectPath(key);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
    },
    async get(key, options) {
      const target = objectPath(key);
      try {
        const details = await stat(target);
        if (!details.isFile()) return null;
        const range = options?.range;
        return { body: Readable.toWeb(createReadStream(target, range ? { start: range.offset, end: range.offset + range.length - 1 } : undefined)), size: details.size };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}
