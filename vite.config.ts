import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 8080,
    hot: true,
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
