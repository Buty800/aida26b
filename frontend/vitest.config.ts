import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
