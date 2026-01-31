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
      // Resolve from source for proper ESM bundling
      '@promptbook/types': path.resolve(__dirname, '../types/src'),
      '@promptbook/ui/styles': path.resolve(__dirname, '../ui/src/styles/index.css'),
      '@promptbook/ui': path.resolve(__dirname, '../ui/src'),
      '@promptbook/sync': path.resolve(__dirname, '../sync/src'),
      '@promptbook/core': path.resolve(__dirname, '../core/src'),
      '@promptbook/core/ui': path.resolve(__dirname, '../core/src/ui'),
      '@promptbook/core/utils': path.resolve(__dirname, '../core/src/utils'),
      '@promptbook/core/styles': path.resolve(__dirname, '../core/src/ui/styles/index.css'),
    },
  },
});
