import vinext from 'vinext';
import { defineConfig } from 'vite';

// Poetio runs only on its own server, under Node (scripts/start-vps.mjs), with the
// SQLite and file-system storage in server/vps-env.ts. The Cloudflare Worker variant
// was retired on 23 Nov 2026.
export default defineConfig({ plugins: [vinext()] });
