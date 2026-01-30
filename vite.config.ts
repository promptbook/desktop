import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: './src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@promptbook/core/ui': path.resolve(__dirname, '../core/src/ui'),
      '@promptbook/core/utils': path.resolve(__dirname, '../core/src/utils'),
      '@promptbook/core/styles': path.resolve(__dirname, '../core/src/ui/styles/index.css'),
    },
  },
});
