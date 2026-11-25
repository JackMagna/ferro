// Dati di esempio e avvio dell'app per la grafica e il video di Google Play (scripts/store-assets.mjs, scripts/store-video.mjs).
// Tutto finto: l'app gira senza account, con dati seminati in localStorage.
import { spawn, execSync } from 'node:child_process';

export const PORT = 4173;
export const BASE = `http://localhost:${PORT}/app/`;

/** Compila l'app (base /app/) e la serve con vite preview. Restituisce il processo da chiudere alla fine. */
export async function startPreview() {
  execSync('node node_modules/vite/bin/vite.js build', { stdio: 'inherit', env: { ...process.env, APP_BASE: '/app/' } });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch { /* non ancora pronto */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return server;
}

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(18, 30, 0, 0); return d; };

/** Dati finti: sei settimane di allenamenti con carichi in crescita, pesate, pasti di oggi e una dieta. */
export function demoData(program) {
  const sessions = [];
  let n = 0;
  for (let w = 0; w < 6; w++) {
    program.days.forEach((day, di) => {
      const date = daysAgo(40 - w * 7 - di * 2);
      if (date > new Date()) return;
      const sets = day.exercises.flatMap((ex, ei) => {
        const base = ex.sectionType === 'core' ? 0 : 20 + ei * 7.5 + w * 2.5;
        return [0, 1, 2].map((i) => ({ exerciseId: ex.id, exerciseName: ex.name, setIndex: i, weightKg: base, reps: 10 - i }));
      });
      sessions.push({
        id: `demo-s${n++}`, date: iso(date), startedAt: date.getTime(), endedAt: date.getTime() + 62 * 60000, dayId: day.id, dayTitle: day.title,
        weekNumber: Math.min(w + 1, program.totalWeeks), durationMinutes: 62,
        totalVolumeKg: sets.reduce((s, x) => s + x.weightKg * x.reps, 0), sets, avgBpm: 118 + w, maxBpm: 158
      });
    });
  }
  const measurements = Array.from({ length: 8 }, (_, i) => ({
    id: `demo-m${i}`, date: iso(daysAgo(49 - i * 7)), weightKg: Math.round((82.4 - i * 0.45 + (i % 2) * 0.2) * 10) / 10,
    bodyFat: Math.round((19.5 - i * 0.3) * 10) / 10, waistCm: 88 - i * 0.6
  }));
  const today = iso(new Date());
  const meals = [
    { id: 'demo-f1', date: today, mealType: 'colazione', name: 'Yogurt greco, avena e frutti di bosco', kcal: 420, proteinG: 32, carbsG: 52, fatG: 9, source: 'manuale' },
    { id: 'demo-f2', date: today, mealType: 'pranzo', name: 'Riso basmati, pollo e verdure', kcal: 640, proteinG: 48, carbsG: 78, fatG: 14, source: 'piano' },
    { id: 'demo-f3', date: today, mealType: 'spuntino-pomeriggio', name: 'Mela e mandorle', kcal: 210, proteinG: 5, carbsG: 22, fatG: 12, source: 'tabella' }
  ];
  const dietPlan = {
    title: 'Piano di ricomposizione', nutritionist: 'Dott.ssa Bianchi', kcalTarget: 2300, proteinG: 160, carbsG: 260, fatG: 70, waterMl: 2500,
    days: [{ id: 'd1', title: 'Ogni giorno', weekdays: [], meals: [
      { id: 'p1', type: 'colazione', description: 'Yogurt greco 200 g, avena 50 g, frutti di bosco', kcal: 420, proteinG: 32, carbsG: 52, fatG: 9 },
      { id: 'p2', type: 'pranzo', description: 'Riso basmati 90 g, pollo 150 g, verdure', kcal: 640, proteinG: 48, carbsG: 78, fatG: 14 },
      { id: 'p3', type: 'cena', description: 'Salmone 180 g, patate 250 g, insalata', kcal: 720, proteinG: 42, carbsG: 55, fatG: 30 }
    ] }]
  };
  program = { ...program, title: 'Scheda autunno', trainer: 'Coach Luca' };
  return { program, sessions, measurements, meals, dietPlan, spreadsheetId: '', savedMeals: [], water: { [today]: 1500 } };
}

/** Telefono 360 × 640 (× 3 = 1080 × 1920), tema scuro, senza account, consenso ai dati sanitari già dato. */
export const PHONE = {
  viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  locale: 'it-IT', timezoneId: 'Europe/Rome', serviceWorkers: 'block', colorScheme: 'dark'
};

/** Apre l'app nel contesto e la riempie con i dati di esempio. */
export async function openDemo(context) {
  await context.addInitScript(() => {
    localStorage.setItem('irontrack:guest', 'true');
    localStorage.setItem('irontrack:consent', JSON.stringify({ version: 1, at: new Date().toISOString() }));
    localStorage.setItem('irontrack:consent-asked', 'true');
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.getByRole('navigation', { name: 'Sezioni' }).waitFor();
  const program = await page.evaluate(() => JSON.parse(localStorage.getItem('irontrack:local-data') ?? '{}').program);
  await page.evaluate((d) => { localStorage.setItem('irontrack:local-data', JSON.stringify(d)); localStorage.removeItem('irontrack:workout-draft'); }, demoData(program));
  await page.reload();
  await page.getByRole('navigation', { name: 'Sezioni' }).waitFor();
  return page;
}
