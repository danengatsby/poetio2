import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { VISIT_CLEANUP_SQL, VISIT_IP_RETENTION_DAYS } from '../lib/visits.ts';
import { resolve } from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';

// Administration needs the owner's address from the server configuration (lib/access.ts).
if (!process.env.POETIO_OWNER_EMAIL?.trim())
  console.warn('POETIO_OWNER_EMAIL is not set: administration is closed until it is added to /etc/poetio/runtime.env.');

const { server } = await startProdServer({
  host: '127.0.0.1',
  port: Number(process.env.POETIO_PORT || 4106),
  outDir: resolve(process.env.POETIO_BUILD_DIR || 'dist'),
});

// Run even when nobody visits the site. Use a short-lived connection to the configured database.
function cleanVisits() {
  const file = resolve(process.env.POETIO_DATA_DIR || '/var/lib/poetio', 'poetio.sqlite3');
  if (!existsSync(file)) return;
  let db;
  try {
    db = new DatabaseSync(file);
    db.exec('PRAGMA busy_timeout=5000');
    db.prepare(VISIT_CLEANUP_SQL).run(Date.now() - VISIT_IP_RETENTION_DAYS * 86400000);
  } catch (error) {
    console.error('Visit retention cleanup failed', error);
  } finally {
    db?.close();
  }
}
cleanVisits();
setInterval(cleanVisits, 24 * 3600000).unref();

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
