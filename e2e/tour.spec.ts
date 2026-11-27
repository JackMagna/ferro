import { test, expect } from './fixtures';

/** Guida al primo accesso: parte da sola per chi è nuovo, si salta, si rivede dall'account; chi ha allenamenti vede solo «Novità». */
test('guida al primo accesso: tappe, salta e rivedi', async ({ page, pageErrors }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:tour-test', 'true');
  });
  await page.goto('./');
  const pop = page.locator('.driver-popover');
  await expect(pop.getByText('Benvenuto in Ferro')).toBeVisible();
  await pop.getByRole('button', { name: 'Iniziamo' }).click();
  await expect(pop.getByText('Ti alleni qui')).toBeVisible();
  await pop.getByRole('button', { name: 'Avanti' }).click();
  await expect(pop.getByText('La tua scheda')).toBeVisible();
  // dietro al fumetto si apre la sezione di cui si parla
  await expect(page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name: 'Scheda' })).toHaveAttribute('aria-current', 'page');
  await pop.getByRole('button', { name: 'Salta' }).click();
  await expect(pop).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('irontrack:tour') ?? 'null')?.status)).toBe('skipped');

  // ricaricando non riparte
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(pop).toHaveCount(0);

  // si rivede da Account e dati e si arriva in fondo
  await page.getByRole('button', { name: 'Account e impostazioni' }).click();
  await page.getByRole('button', { name: 'Rivedi la guida' }).click();
  await expect(pop.getByText('Benvenuto in Ferro')).toBeVisible();
  for (let i = 0; i < 6; i++) await pop.getByRole('button', { name: i === 0 ? 'Iniziamo' : 'Avanti' }).click();
  await expect(pop.getByText('Collega e personalizza')).toBeVisible();
  await pop.getByRole('button', { name: 'Collega la scheda del coach' }).click();
  await expect(pop).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name: 'Scheda' })).toHaveAttribute('aria-current', 'page');
  expect(pageErrors).toEqual([]);
});

test('chi ha già allenamenti vede solo la riga Novità', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:tour-test', 'true');
    const data = JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}');
    localStorage.setItem('irontrack:local-data', JSON.stringify({ ...data, sessions: [{ id: 's1', date: '2026-11-01', startedAt: 1, endedAt: 2, dayId: 'g1', dayTitle: 'Giorno 1', weekNumber: 1, durationMinutes: 40, totalVolumeKg: 0, sets: [] }] }));
  });
  await page.goto('./');
  await expect(page.getByText('Novità: una guida di un minuto')).toBeVisible();
  await expect(page.locator('.driver-popover')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardala' }).click();
  await expect(page.locator('.driver-popover').getByText('Benvenuto in Ferro')).toBeVisible();
  await page.locator('.driver-popover').getByRole('button', { name: 'Salta' }).click();
  await expect(page.getByText('Novità: una guida di un minuto')).toHaveCount(0);
});
