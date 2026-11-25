import { test as base, expect, type Page } from '@playwright/test';
import { resetEmulators } from './emulator';

/**
 * Ogni test: emulatori vuoti, conferme del browser accettate, errori della pagina raccolti
 * (un errore JavaScript non gestito fa fallire il test, come un crash per l'utente).
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await use(errors);
    expect(errors, 'Errori JavaScript nella pagina').toEqual([]);
  },
  page: async ({ page }, use) => {
    await resetEmulators();
    page.on('dialog', (d) => void d.accept());
    await use(page);
  }
});

export { expect };

export const nav = (page: Page, section: 'Allenamento' | 'Scheda' | 'Pasti' | 'Esercizi' | 'Progressi') =>
  page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name: section }).click();

/** Progressi → Misure */
export async function openMeasures(page: Page) {
  await nav(page, 'Progressi');
  await page.getByRole('radiogroup', { name: 'Sezione' }).getByRole('radio', { name: 'Misure' }).click();
}

/** Completa le prime `sets` serie dell'esercizio aperto e salva l'allenamento. */
export async function doWorkout(page: Page, sets = 1) {
  await nav(page, 'Allenamento');
  for (let i = 1; i <= sets; i++) await page.getByRole('button', { name: `Completa serie ${i}` }).click();
  await page.getByRole('button', { name: 'Concludi' }).click();
  await page.getByRole('button', { name: 'Salva allenamento' }).click();
  await expectToast(page, `Allenamento salvato: ${sets} serie`);
}

/** Avviso in basso (toast) con quel testo. */
export const expectToast = (page: Page, text: string) => expect(page.getByRole('status').filter({ hasText: text })).toBeVisible();

export async function openAccount(page: Page) {
  await page.getByRole('button', { name: 'Account e impostazioni' }).click();
  return page.getByRole('dialog', { name: 'Account e dati' });
}
