import { resolve } from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';

const { server } = await startProdServer({
  host: '127.0.0.1',
  port: Number(process.env.POETIO_PORT || 4106),
  outDir: resolve(process.env.POETIO_BUILD_DIR || 'dist'),
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
