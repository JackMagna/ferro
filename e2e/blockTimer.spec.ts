import { test, expect } from './fixtures';

/** Timer dei blocchi con l'orologio finto del browser: For Time con «Fine» e Tabata con lavoro e recuperi. */
const program = {
  title: 'WOD', athlete: '', trainer: '', totalWeeks: 1,
  guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [{
    id: 'giorno-1', title: 'Giorno 1',
    blocks: [
      { id: 'b1', format: 'for_time', timeCapSec: 900, score: 'tempo', title: 'For Time' },
      { id: 'b2', format: 'intervalli', workSec: 20, restSec: 10, rounds: 8, score: 'rip', title: 'Tabata' }
    ],
    exercises: [
      { id: 'bu', name: 'Burpees', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: '50' }, blockId: 'b1' },
      { id: 'sj', name: 'Squat jump', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: 'max' }, blockId: 'b2' }
    ]
  }]
};

test('timer dei blocchi: For Time a salire con «Fine», Tabata con giri e recuperi', async ({ page, pageErrors }) => {
  await page.clock.install({ time: new Date('2026-11-06T18:00:00') });
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:local-data', JSON.stringify({ program: p, sessions: [], measurements: [], meals: [], dietPlan: null, spreadsheetId: '', savedMeals: [], water: {} }));
  }, program);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Burpees' })).toBeVisible();

  // For Time: 10" di pronti, poi il tempo sale; «Fine» lo scrive nel risultato
  await page.getByRole('button', { name: 'Avvia timer' }).click();
  const timer = page.getByRole('timer', { name: 'Timer For Time' });
  await expect(timer.getByText('Pronti')).toBeVisible();
  await page.clock.runFor(10_000 + 95_000);
  await expect(timer.getByText('1:35')).toBeVisible();
  await expect(timer.getByText('Limite 15:00')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/timer-fortime.png' });
  await timer.getByRole('button', { name: 'Fine' }).click();
  await expect(timer.getByText('Fatto')).toBeVisible();
  await timer.getByRole('button', { name: 'Chiudi' }).click();
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();

  // Tabata: giro 1 di 8, poi il recupero
  await expect(page.getByRole('heading', { name: 'Squat jump' })).toBeVisible();
  await page.getByRole('button', { name: 'Avvia timer' }).click();
  const tabata = page.getByRole('timer', { name: 'Timer Tabata' });
  await page.clock.runFor(15_000);
  await expect(tabata.getByText('Giro 1 di 8')).toBeVisible();
  await expect(tabata.getByText('Via')).toBeVisible();
  await page.clock.runFor(21_000);
  await expect(tabata.getByText('Recupero')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/timer-tabata.png' });
  await tabata.getByRole('button', { name: 'Pausa' }).click();
  await expect(tabata.getByText('In pausa')).toBeVisible();
  await page.clock.runFor(60_000);
  await tabata.getByRole('button', { name: 'Riprendi' }).click();
  await expect(tabata.getByText('Recupero')).toBeVisible();
  await page.clock.runFor(300_000);
  await expect(tabata.getByText('Fatto')).toBeVisible();
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();

  await page.getByRole('button', { name: 'Concludi' }).click();
  await page.getByRole('button', { name: 'Salva allenamento' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}').sessions.length)).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}').sessions[0]);
  expect(saved.blockResults.find((b: { blockId: string }) => b.blockId === 'b1')).toMatchObject({ kind: 'tempo', timeSec: 95 });
  expect(pageErrors).toEqual([]);
});
