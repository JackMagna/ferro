import { test, expect, nav, expectToast } from './fixtures';

const program = {
  title: 'Scheda', athlete: '', trainer: '', totalWeeks: 1,
  guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [
    { id: 'g1', title: 'Giorno 1', exercises: [{ id: 'pa', name: 'Panca piana', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: '3x10' } }] },
    { id: 'g2', title: 'Giorno 2', exercises: [{ id: 'sq', name: 'Squat', sectionType: 'progressione', restTimeSec: 0, weeks: { 1: '3x10' } }] }
  ]
};

const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'SUMMARY:Spinning', 'DTSTART:20991112T070000', 'DURATION:PT45M', 'LOCATION:Sala bike', 'DESCRIPTION:Prenotazione di Mario Rossi', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('lezioni fisse: aggiunta, segnata come fatta, import .ics e calendario', async ({ page, pageErrors }) => {
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:local-data', JSON.stringify({ program: p, sessions: [], measurements: [], meals: [], dietPlan: null, spreadsheetId: '', savedMeals: [], water: {} }));
  }, program);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Panca piana' })).toBeVisible();
  // senza lezioni in Allenamento non compare niente
  await expect(page.getByRole('region', { name: 'Lezioni' })).toHaveCount(0);

  // Scheda → Lezioni e corsi → nuova lezione oggi alle 00:00
  await nav(page, 'Scheda');
  await page.getByRole('heading', { name: 'Lezioni e corsi' }).locator('xpath=../..').getByRole('button', { name: 'Aggiungi' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi' }).click();
  await page.getByLabel('Lezione', { exact: true }).fill('Pilates reformer');
  await page.getByLabel('Ora').fill('00:00');
  await page.getByLabel('Durata (min)').fill('50');
  await page.getByLabel('Dove (facoltativo)').fill('Studio, sala 2');
  await page.screenshot({ path: 'e2e-results/lezioni-nuova.png' });
  await page.getByRole('button', { name: 'Salva' }).click();
  await expectToast(page, 'Lezione salvata');
  await expect(page.getByRole('dialog').getByText('Pilates reformer')).toBeVisible();

  // metti nel calendario: nel browser Google Calendar e file .ics
  await page.getByRole('button', { name: 'Metti Pilates reformer nel calendario' }).click();
  await expect(page.getByRole('button', { name: 'Google Calendar' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /File \.ics/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ferro-pilates-reformer.ics');

  // import da .ics: la descrizione non entra
  await page.getByRole('dialog').getByLabel('File .ics').setInputFiles({ name: 'prenotazione.ics', mimeType: 'text/calendar', buffer: Buffer.from(ICS) });
  await expect(page.getByRole('heading', { name: 'Lezioni trovate' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Spinning', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi' }).click();
  await expectToast(page, 'Aggiunta 1 lezione');
  await page.screenshot({ path: 'e2e-results/lezioni-elenco.png' });
  await page.keyboard.press('Escape');

  // Allenamento: la lezione di oggi, segnata come fatta
  await nav(page, 'Allenamento');
  const card = page.getByRole('region', { name: 'Lezioni' });
  await expect(card.getByText('Pilates reformer')).toBeVisible();
  await page.screenshot({ path: 'e2e-results/lezioni-oggi.png' });
  await card.getByRole('button', { name: 'Fatta' }).click();
  await expectToast(page, 'Segnata: Pilates reformer');
  await expect(card.getByRole('button', { name: 'Fatta' })).toHaveCount(0);

  const stored = await page.evaluate(() => ({
    sessions: JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}').sessions,
    lessons: localStorage.getItem('irontrack:lessons') ?? ''
  }));
  expect(stored.sessions).toHaveLength(1);
  expect(stored.sessions[0]).toMatchObject({ dayId: 'lezione', dayTitle: 'Pilates reformer', durationMinutes: 50, sets: [] });
  expect(stored.lessons).not.toContain('Mario');

  // la scheda resta al giorno 1: la lezione non sposta la rotazione
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Panca piana' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
