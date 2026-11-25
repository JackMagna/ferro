import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Test nel browser della versione con account Google, senza account Google veri:
 * - accesso Google e Firestore sono gli emulatori Firebase (progetto finto «demo-ferro», regole di firestore.rules);
 * - Google Sheets è simulato dentro i test (e2e/fakeSheets.ts).
 * Gli emulatori richiedono Java 21+: FERRO_JAVA_HOME, oppure un JDK in ~/tools/jdk-21…, oppure JAVA_HOME.
 * Avvio: `bun run test:e2e` (gli emulatori e l'app partono da soli).
 */
function javaHome(): string | undefined {
  if (process.env.FERRO_JAVA_HOME) return process.env.FERRO_JAVA_HOME;
  const tools = join(homedir(), 'tools');
  const jdk = existsSync(tools) ? readdirSync(tools).filter((d) => /^jdk-2\d/.test(d)).sort().pop() : undefined;
  return jdk ? join(tools, jdk) : process.env.JAVA_HOME;
}

const java = javaHome();
const sep = process.platform === 'win32' ? ';' : ':';
const PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/globalSetup.ts',
  // un solo emulatore condiviso: i test girano uno alla volta e ognuno parte da database vuoto
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    baseURL: `http://localhost:${PORT}/app/`,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'firebase emulators:start --only auth,firestore --project demo-ferro',
      url: 'http://127.0.0.1:4400/emulators',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: java ? { JAVA_HOME: java, PATH: `${join(java, 'bin')}${sep}${process.env.PATH ?? ''}` } : {}
    },
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/app/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_FIREBASE_EMULATOR: '1' }
    }
  ]
});
