import { test, expect, nav, doWorkout } from './fixtures';
import { MARIO, getDoc, grantSheetsToken, loginWithGoogle, uidOf } from './emulator';
import { FakeSheets, SHEET_ID, SHEET_LINK } from './fakeSheets';
import { MISURE, SHEET } from '../src/lib/__tests__/fixtures';

test.describe('Scheda del coach da Google Sheets (simulato)', () => {
  test('importa la scheda, la salva nel cloud e scrive i carichi nel foglio', async ({ page }) => {
    const sheets = new FakeSheets({ ALLENAMENTO: SHEET, MISURE });
    await sheets.install(page);
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await grantSheetsToken(page);

    await nav(page, 'Scheda');
    await page.getByRole('button', { name: 'Collega la scheda del coach' }).click();
    const dialog = page.getByRole('dialog', { name: 'Scheda del coach da Google Sheets' });
    await dialog.getByPlaceholder('https://docs.google.com/spreadsheets/d/…').fill(SHEET_LINK);
    await dialog.getByRole('button', { name: 'Apri foglio' }).click();
    await dialog.getByRole('combobox').selectOption('ALLENAMENTO');
    await dialog.getByRole('button', { name: 'Leggi la scheda' }).click();
    await expect(dialog).toContainText('Programma palestra', { ignoreCase: true });
    await page.getByRole('button', { name: 'Usa questa scheda' }).click();

    const uid = await uidOf(MARIO);
    await expect.poll(async () => (await getDoc(`users/${uid}`))?.spreadsheetId).toBe(SHEET_ID);
    await expect.poll(async () => ((await getDoc(`users/${uid}`))?.program as { source?: { tab?: string } })?.source?.tab).toBe('ALLENAMENTO');
    const program = (await getDoc(`users/${uid}`))!.program as { days: { exercises: { name: string }[] }[]; source?: { tab?: string } };
    expect(program.source?.tab).toBe('ALLENAMENTO');
    expect(program.days).toHaveLength(2);
    expect(program.days[0].exercises.map((e) => e.name.toLowerCase())).toContain('chest press presa sopra');

    // allenamento: il carico va nella colonna della settimana 1, accanto alla prescrizione del coach
    await doWorkout(page, 1);
    await expect.poll(() => sheets.writes.length, { timeout: 20_000 }).toBeGreaterThan(0);
    const write = sheets.writes.find((w) => w.range.includes('ALLENAMENTO'));
    expect(write, `scritture: ${JSON.stringify(sheets.writes)}`).toBeTruthy();
    expect(String(write!.value)).toMatch(/kg/);
  });

  test('link sbagliato: messaggio chiaro', async ({ page }) => {
    const sheets = new FakeSheets({ ALLENAMENTO: SHEET });
    await sheets.install(page);
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await grantSheetsToken(page);
    await nav(page, 'Scheda');
    await page.getByRole('button', { name: 'Collega la scheda del coach' }).click();
    const dialog = page.getByRole('dialog', { name: 'Scheda del coach da Google Sheets' });
    await dialog.getByPlaceholder('https://docs.google.com/spreadsheets/d/…').fill('https://docs.google.com/spreadsheets/d/altro-foglio/edit');
    await dialog.getByRole('button', { name: 'Apri foglio' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Foglio non trovato');
  });
});
