import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
