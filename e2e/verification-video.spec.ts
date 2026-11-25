import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { MARIO, grantSheetsToken } from './emulator';
import { FakeSheets, SHEET_LINK } from './fakeSheets';
import { MISURE, SHEET } from '../src/lib/__tests__/fixtures';

/**
 * Video dimostrativo per la verifica Google dell'ambito «spreadsheets» (non fa parte di `bun run test:e2e`).
 * Avvio: node scripts/verification-video.mjs (registra e monta verifica-google/ferro-demo-sheets.mp4).
 * L'interfaccia è in inglese dove già tradotta: i nomi dei pulsanti si cercano in italiano o in inglese.
 */
test.skip(!process.env.FERRO_VIDEO, 'solo con FERRO_VIDEO=1 (scripts/verification-video.mjs)');
test.use({
  isMobile: false,
  hasTouch: false,
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  userAgent: undefined,
  locale: 'en-GB',
  video: { mode: 'on', size: { width: 1280, height: 720 } },
  launchOptions: { slowMo: 250 }
});

const OUT = 'verifica-google/tmp';
const SITE = 'https://palestra-kohl.vercel.app';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Nome in italiano o in inglese (la traduzione è in corso). */
const bi = (it: string, en: string) => new RegExp(`^(${esc(it)}|${esc(en)})`, 'i');

/** Didascalia in inglese, impressa nella registrazione. */
async function caption(page: Page, title: string, sub = '') {
  await page.evaluate(([t, s]) => {
    document.getElementById('vcap')?.remove();
    const d = document.createElement('div');
    d.id = 'vcap';
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;max-width:1100px;width:max-content;' +
      'background:rgba(10,10,10,.88);color:#fff;padding:14px 26px;border-radius:14px;font:600 26px/1.3 system-ui,Segoe UI,Arial,sans-serif;' +
      'text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.4);pointer-events:none';
    d.innerHTML = `<div>${t}</div>` + (s ? `<div style="font-weight:400;font-size:19px;opacity:.85;margin-top:4px">${s}</div>` : '');
    document.body.appendChild(d);
  }, [title, sub]);
}

/** Pulsante dell'account: sul desktop è il nome nella barra laterale. */
const accountButton = (page: Page) => page.getByRole('button', { name: /^(Account e impostazioni|Account and settings|Mario)/ }).filter({ visible: true }).first();

const smoothScroll = (page: Page, y: number) => page.evaluate((top) => window.scrollBy({ top, behavior: 'smooth' }), y);

/** Il foglio Google simulato come tabella sopra l'app: le celle scritte da Ferro in giallo. */
async function showSheet(page: Page, sheets: FakeSheets) {
  const written = sheets.writes.map((w) => w.range.replace(/'/g, ''));
  const grid = (tab: string, from: number, to: number) => ({ tab, from, rows: (sheets.tabs.get(tab) ?? []).slice(from - 1, to) });
  await page.evaluate(({ parts, written }) => {
    const col = (i: number) => String.fromCharCode(65 + i);
    const html = parts.map(({ tab, from, rows }) => {
      const width = Math.min(8, Math.max(...rows.map((r) => r.length), 1));
      const head = `<tr><th></th>${Array.from({ length: width }, (_, i) => `<th>${col(i)}</th>`).join('')}</tr>`;
      const body = rows.map((r, ri) => `<tr><th>${from + ri}</th>${Array.from({ length: width }, (_, ci) => {
        const hit = written.includes(`${tab}!${col(ci)}${from + ri}`);
        return `<td style="${hit ? 'background:#ffe14d;font-weight:700;outline:2px solid #d4a800' : ''}">${r[ci] ?? ''}</td>`;
      }).join('')}</tr>`).join('');
      return `<div style="margin:0 0 10px"><b>Tab: ${tab}</b></div><table>${head}${body}</table>`;
    }).join('<div style="height:16px"></div>');
    const d = document.createElement('div');
    d.id = 'vsheet';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#f1f3f4;overflow:hidden;padding:18px 28px;font:13px Arial,sans-serif;color:#202124';
    d.innerHTML = `<style>#vsheet table{border-collapse:collapse;background:#fff}#vsheet td,#vsheet th{border:1px solid #dadce0;padding:3px 8px;white-space:nowrap;max-width:260px;overflow:hidden}#vsheet th{background:#f8f9fa;color:#5f6368;font-weight:400}</style>` +
      `<div style="font:500 18px Arial;margin-bottom:10px">Coach's Google Sheet (simulated Sheets API in this recording): cells written by Ferro are highlighted</div>${html}`;
    document.body.appendChild(d);
  }, { parts: [grid('ALLENAMENTO', 7, 18), grid('MISURE', 8, 14)], written });
}

test('video per la verifica Google (Sheets)', async ({ page }) => {
  test.setTimeout(300_000);
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const mark = (id: string) => { marks[id] = (Date.now() - t0) / 1000; };
  await page.addInitScript(() => localStorage.setItem('irontrack:lang', JSON.stringify('en')));
  // misure del foglio senza valori: la nuova misura va nella settimana 1 senza conflitti con quella del coach
  const sheets = new FakeSheets({ ALLENAMENTO: SHEET, MISURE: MISURE.map((r, i) => (i > 7 ? r.slice(0, 1) : r)) });
  await sheets.install(page);

  // 1. sito e informativa
  mark('start');
  await page.goto(SITE + '/');
  await caption(page, 'Ferro — home page', 'palestra-kohl.vercel.app');
  await page.waitForTimeout(3500);
  await smoothScroll(page, 600);
  await page.waitForTimeout(2500);

  await page.goto(SITE + '/privacypolicy.html');
  await caption(page, 'Privacy policy', 'palestra-kohl.vercel.app/privacypolicy.html');
  await page.waitForTimeout(3000);
  // sezione 5: collegamenti con Google (Health, Fogli); la voce di Google Fogli evidenziata
  const sheetsItem = page.locator('li', { has: page.locator('strong', { hasText: /^Google (Fogli|Sheets)$/ }) }).first();
  await sheetsItem.evaluate((el) => { el.style.background = '#fff3a8'; el.style.outline = '3px solid #e0b400'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  await caption(page, 'Privacy policy: how Ferro uses Google user data', 'Google Sheets data is used only to read the program and write the user\'s own loads');
  await page.waitForTimeout(5500);

  // 2. accesso
  await page.goto('./');
  await caption(page, 'The Ferro app', 'palestra-kohl.vercel.app/app/');
  await page.waitForTimeout(3000);
  const signIn = page.getByRole('button', { name: bi('Accedi con Google', 'Sign in with Google') }).first();
  await signIn.scrollIntoViewIfNeeded();
  await caption(page, 'Step 1 — Sign in with Google');
  await page.waitForTimeout(2000);
  const popupPromise = page.waitForEvent('popup');
  await signIn.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain('127.0.0.1:9099'); // emulatore, mai Google vero
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.locator('#email-input').fill(MARIO.email);
  await popup.locator('#display-name-input').fill(MARIO.name);
  await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
  await expect(accountButton(page)).toContainText('Mario');
  await grantSheetsToken(page);
  await caption(page, 'Signed in', 'Next: the user links the coach\'s Google Sheet and grants the Sheets permission');
  await page.waitForTimeout(2000);
  mark('consent'); // qui va il consenso Google vero (consent.mp4)
  await page.waitForTimeout(2000);

  // 3. collegamento del foglio
  const nav = page.getByRole('navigation', { name: bi('Sezioni', 'Sections') }).filter({ visible: true });
  await nav.getByRole('button', { name: bi('Scheda', 'Program') }).click();
  await caption(page, 'Step 2 — Link the coach\'s Google Sheet', 'The user pastes the link of the spreadsheet shared by the coach');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: bi('Collega la scheda del coach', "Link the coach") }).click();
  const dialog = page.getByRole('dialog').last();
  await dialog.getByPlaceholder('https://docs.google.com/spreadsheets/d/…').pressSequentially(SHEET_LINK, { delay: 25 });
  await page.waitForTimeout(800);
  await dialog.getByRole('button', { name: bi('Apri foglio', 'Open sheet') }).click();
  await caption(page, 'Ferro reads the list of tabs (Sheets API)', 'The user picks the tab with the training program');
  await dialog.getByRole('combobox').selectOption('ALLENAMENTO');
  await page.waitForTimeout(2000);
  await dialog.getByRole('button', { name: bi('Leggi la scheda', 'Read the program') }).click();
  await expect(dialog).toContainText('Programma palestra', { ignoreCase: true });
  await caption(page, 'Ferro reads the program from the sheet', 'Days, exercises, sets and reps written by the coach');
  await page.waitForTimeout(3500);
  await dialog.evaluate((el) => el.querySelector('[class*="overflow-y"]')?.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: bi('Usa questa scheda', 'Use this program') }).click();
  await caption(page, 'Program imported from Google Sheets');
  await page.waitForTimeout(3000);
  await smoothScroll(page, 500);
  await page.waitForTimeout(3000);

  // 4. allenamento: il carico torna nel foglio
  await nav.getByRole('button', { name: bi('Allenamento', 'Workout') }).click();
  await caption(page, 'Step 3 — Log a set with its load (kg)');
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: bi('Completa serie 1', 'Complete set 1') }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: bi('Concludi', 'Finish') }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: bi('Salva allenamento', 'Save workout') }).click();
  await caption(page, 'Workout saved: Ferro writes the load back into the coach\'s sheet');
  await expect.poll(() => sheets.writes.some((w) => w.range.includes('ALLENAMENTO')), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(3000);

  // 5. una misura: va nella scheda MISURE
  await nav.getByRole('button', { name: bi('Progressi', 'Progress') }).click();
  await page.getByRole('radiogroup').first().getByRole('radio', { name: bi('Misure', 'Measurements') }).click();
  await caption(page, 'Step 4 — Add a body measurement', 'It is written to the MEASUREMENTS tab of the same sheet');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: bi('Nuova misura', 'New measurement') }).click();
  await page.locator('#m-weightKg').pressSequentially('104,5', { delay: 120 });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: bi('Salva misura', 'Save measurement') }).click();
  const consent = page.getByRole('dialog').last();
  await caption(page, 'Health data needs explicit consent (GDPR art. 9)');
  await page.waitForTimeout(2500);
  await consent.getByRole('checkbox').check();
  await page.waitForTimeout(800);
  await consent.getByRole('button', { name: bi('Acconsento', 'I consent') }).click();
  await caption(page, "Measurement saved and written to the coach's sheet");
  await expect.poll(() => sheets.writes.some((w) => w.range.includes('MISURE')), { timeout: 20_000 }).toBe(true).catch(() => undefined);
  await page.waitForTimeout(2500);

  // 6. il foglio dopo le scritture
  await showSheet(page, sheets);
  await caption(page, 'Result in the coach\'s sheet', 'Ferro writes only the user\'s loads and measurements, in the cells for this week');
  await page.waitForTimeout(7000);
  await page.evaluate(() => document.getElementById('vsheet')?.remove());

  // 7. controllo dei dati
  await caption(page, 'Account and data: the user is in control', 'Sign out, or delete the account and all its data from the cloud and the device');
  await accountButton(page).click();
  const account = page.getByRole('dialog').last();
  await page.waitForTimeout(2500);
  const del = account.getByRole('button', { name: bi('Elimina account e dati', 'Delete account and data') });
  await del.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await page.waitForTimeout(5000);
  await caption(page, 'Ferro', 'palestra-kohl.vercel.app · privacy policy: palestra-kohl.vercel.app/privacypolicy.html');
  await page.waitForTimeout(3500);
  mark('end');

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/marks.json`, JSON.stringify({ marks, writes: sheets.writes }, null, 2));
  await page.close();
  await page.video()!.saveAs(`${OUT}/raw.webm`);
});
