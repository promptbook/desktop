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
      // Resolve @promptbook/core from source for proper ESM bundling
      '@promptbook/core/styles': path.resolve(__dirname, '../core/src/ui/styles/index.css'),
      '@promptbook/core/kernel': path.resolve(__dirname, '../core/src/kernel'),
      '@promptbook/core/utils': path.resolve(__dirname, '../core/src/utils'),
      '@promptbook/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
