import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    // Academic corpus bundle is ~550KB uncompressed (~140KB gzipped), perfectly fine for modern browsers
    chunkSizeWarningLimit: 1000
  }
});
