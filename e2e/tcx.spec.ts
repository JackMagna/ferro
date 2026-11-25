import { test, expect, nav } from './fixtures';

const program = {
  title: 'Scheda', athlete: '', trainer: '', totalWeeks: 1,
  guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [{ id: 'g1', title: 'Corsa lunga', exercises: [{ id: 'co', name: 'Corsa', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: '5 km' } }] }]
};
const start = Date.parse('2026-11-05T07:00:00Z');
const session = {
  id: 's1', date: '2026-11-05', startedAt: start, endedAt: start + 30 * 60_000, dayId: 'g1', dayTitle: 'Corsa lunga', weekNumber: 1,
  durationMinutes: 30, totalVolumeKg: 0, avgBpm: 150,
  sets: [{ exerciseId: 'co', exerciseName: 'Corsa', setIndex: 0, weightKg: 0, reps: 0, distanceM: 5000, durationSec: 1500 }]
};

test('storico: serie di corsa leggibile ed export TCX per Strava', async ({ page, pageErrors }) => {
  await page.addInitScript(({ p, s }) => {
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:local-data', JSON.stringify({ program: p, sessions: [s], measurements: [], meals: [], dietPlan: null, spreadsheetId: '', savedMeals: [], water: {} }));
  }, { p: program, s: session });
  await page.goto('./');
  await nav(page, 'Progressi');
  await page.getByRole('button', { name: /Corsa lunga/ }).click();
  await expect(page.getByText('5 km in 25 min')).toBeVisible();
  await expect(page.getByText(/Carica attività/)).toBeVisible();
  // la corsa non ha massimale né «0 kg»: niente andamento, nel riepilogo la distanza
  await expect(page.getByRole('heading', { name: 'Andamento esercizio' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Corsa lunga/ })).toContainText('1 serie · 5 km · 30 min');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Esporta TCX/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ferro-2026-11-05-corsa-lunga.tcx');
  const xml = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(xml).toContain('<Activity Sport="Running">');
  expect(xml).toContain('<DistanceMeters>5000</DistanceMeters>');
  await page.screenshot({ path: 'e2e-results/storico-tcx.png' });
  expect(pageErrors).toEqual([]);
});
