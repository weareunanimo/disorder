import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Em desenvolvimento, serve a função /api/preview (a mesma que roda na Vercel).
function previewApi() {
  return {
    name: 'preview-api',
    configureServer(server: { middlewares: { use: (path: string, fn: (req: unknown, res: unknown) => unknown) => void } }) {
      server.middlewares.use('/api/preview', (req, res) => require('./api/preview.js')(req, res));
    },
  };
}

export default defineConfig({
  plugins: [react(), previewApi()],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
