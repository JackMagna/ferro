import { test, expect, nav } from './fixtures';

/** Scheda mista senza account: cardio a tempo, tenuta, ripetute di corsa e un blocco AMRAP. */
const program = {
  title: 'Scheda mista', athlete: '', trainer: '', totalWeeks: 1,
  guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [{
    id: 'giorno-1', title: 'Giorno 1',
    blocks: [{ id: 'b1', format: 'amrap', durationSec: 720, score: 'giri_rip', title: "AMRAP 12'" }],
    exercises: [
      { id: 'cy', name: 'Cyclette', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: "20' Z2" } },
      { id: 'pl', name: 'Plank', sectionType: 'core', restTimeSec: 30, weeks: { 1: "3x45''" } },
      { id: 'co', name: 'Corsa', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: "6x1000 r 2'" } },
      { id: 'wb', name: 'Wall ball', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: '15' }, blockId: 'b1' }
    ]
  }]
};

test('scheda mista: cardio, tenuta, ripetute e blocco AMRAP si registrano e si salvano', async ({ page, pageErrors }) => {
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:local-data', JSON.stringify({ program: p, sessions: [], measurements: [], meals: [], dietPlan: null, spreadsheetId: '', savedMeals: [], water: {} }));
  }, program);
  await page.goto('./');

  // cyclette: durata già scritta (20 min), un solo «Fatto»
  await expect(page.getByRole('heading', { name: 'Cyclette' })).toBeVisible();
  await expect(page.getByText('20 min · Z2')).toBeVisible();
  await expect(page.getByText('Durata', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'e2e-results/attivita-cyclette.png' });
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();

  // plank: tenute in secondi
  await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
  await expect(page.getByText('3 tenute da 45"')).toBeVisible();
  await expect(page.getByText('Secondi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Completa serie 1' }).click();

  // corsa a ripetute
  await page.getByRole('navigation', { name: 'Esercizi della giornata' }).getByRole('button', { name: /Corsa/ }).click();
  await expect(page.getByText('6 ripetute da 1 km, recupero 2 min')).toBeVisible();
  await expect(page.getByText('Ripetute fatte', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();

  // blocco AMRAP: risultato giri + ripetizioni
  await expect(page.getByRole('heading', { name: 'Wall ball' })).toBeVisible();
  await expect(page.getByText('AMRAP 12 min: più giri possibili')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/attivita-amrap.png' });
  await page.getByRole('button', { name: 'Fatto', exact: true }).click();

  await page.getByRole('button', { name: 'Concludi' }).click();
  await page.getByRole('button', { name: 'Salva allenamento' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Allenamento salvato: 4 serie' }).last()).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}').sessions[0]);
  expect(saved.sets.find((s: { exerciseId: string }) => s.exerciseId === 'cy')).toMatchObject({ durationSec: 1200 });
  expect(saved.sets.find((s: { exerciseId: string }) => s.exerciseId === 'co')).toMatchObject({ reps: 6, distanceM: 6000 });
  expect(saved.sets.find((s: { exerciseId: string }) => s.exerciseId === 'pl')).toMatchObject({ durationSec: 45, reps: 0 });

  await nav(page, 'Progressi');
  expect(pageErrors).toEqual([]);
});
