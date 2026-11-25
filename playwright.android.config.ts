import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Test sull'app Android (telefono collegato via USB con il debug USB attivo, oppure emulatore Android).
 * Prima: `node scripts/android-e2e-build.mjs` (APK di prova). Poi: `bun run test:android`.
 * Servono solo gli emulatori Firebase: l'app li raggiunge con `adb reverse`.
 */
const firebase = (Array.isArray(base.webServer) ? base.webServer : [])[0];

export default defineConfig({
  testDir: 'e2e-android',
  globalSetup: './e2e/globalSetup.ts',
  workers: 1,
  // sull'emulatore di GitHub un test può cadere per lentezza del sistema: un secondo tentativo
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report-android' }]],
  outputDir: 'e2e-results-android',
  webServer: firebase ? [firebase] : []
});
