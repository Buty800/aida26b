import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/api_tests.ts'],
    pool: 'forks',
    fileParallelism: false,
  },
});
