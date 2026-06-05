import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  testDir: __dirname,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: process.env.E2E_HEADLESS === '0' ? false : true,
    viewport: { width: 1280, height: 900 },
  },
});

