import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId = Date.now().toString(36);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${buildId}.js`,
        chunkFileNames: `assets/[name]-[hash]-${buildId}.js`,
        assetFileNames: (assetInfo) =>
          assetInfo.name === 'suvarna-logo.svg'
            ? 'assets/suvarna-logo-v20261105.svg'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
