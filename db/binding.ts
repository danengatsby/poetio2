import { env } from 'cloudflare:workers';
import type { Database } from './poems';

export function getPoemDb(): Database {
  const db = (env as unknown as { DB?: Database }).DB;
  if (!db) throw new Error('Poem database binding unavailable');
  return db;
}
