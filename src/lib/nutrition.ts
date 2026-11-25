import type { DietDay, DietPlan, FoodEntry, MealType, PlanMeal, SavedFood, SavedMeal, WaterLog } from '../types';
import { parseNumber } from './measuresSheet';
import { normalizeDietPlan } from '../services/normalize';

export const MEAL_TYPES: MealType[] = ['colazione', 'spuntino-mattina', 'pranzo', 'spuntino-pomeriggio', 'cena', 'altro'];
export const MEAL_LABEL: Record<MealType, string> = {
  colazione: 'Colazione',
  'spuntino-mattina': 'Spuntino di metà mattina',
  pranzo: 'Pranzo',
  'spuntino-pomeriggio': 'Merenda',
  cena: 'Cena',
  altro: 'Altro'
};
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const WEEKDAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export interface Totals { kcal: number; proteinG: number; carbsG: number; fatG: number }
const round = (n: number) => Math.round(n * 10) / 10;

export function totalsOf(entries: Pick<FoodEntry, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>[]): Totals {
  const t = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const e of entries) {
    t.kcal += e.kcal || 0;
    t.proteinG += e.proteinG || 0;
    t.carbsG += e.carbsG || 0;
    t.fatG += e.fatG || 0;
  }
  return { kcal: Math.round(t.kcal), proteinG: round(t.proteinG), carbsG: round(t.carbsG), fatG: round(t.fatG) };
}

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(toMs(iso) + n * DAY).toISOString().slice(0, 10);
/** 0 = lunedì … 6 = domenica */
export const weekdayIndex = (iso: string) => (new Date(toMs(iso)).getUTCDay() + 6) % 7;

/** Orario predefinito (ora, minuti) per tipo di pasto, se non è stata scelta un'ora. */
const DEFAULT_TIME: Record<MealType, [number, number]> = {
  colazione: [8, 0],
  'spuntino-mattina': [10, 30],
  pranzo: [13, 0],
  'spuntino-pomeriggio': [16, 30],
  cena: [20, 0],
  altro: [12, 0]
};
export const MEAL_DURATION_MS = 15 * 60_000;

/** Ora locale "HH:MM" di un istante in ms. */
export function timeOfDay(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Istante in ms (ora locale) di una data AAAA-MM-GG e di un'ora "HH:MM"; undefined se l'ora non è valida. */
export function eatenAtFrom(date: string, hhmm: string): number | undefined {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2])).getTime();
}

/** Inizio e fine (ms) del pasto: l'ora scelta oppure l'orario predefinito del tipo, durata 15 minuti. */
export function mealInterval(entry: Pick<FoodEntry, 'date' | 'mealType' | 'eatenAt'>): { startMs: number; endMs: number } {
  const [h, min] = DEFAULT_TIME[entry.mealType] ?? DEFAULT_TIME.altro;
  const startMs = entry.eatenAt ?? eatenAtFrom(entry.date, `${h}:${String(min).padStart(2, '0')}`) ?? Date.now();
  return { startMs, endMs: startMs + MEAL_DURATION_MS };
}

export const entriesFor =(entries: FoodEntry[], date: string) => entries.filter((e) => e.date === date);

/**
 * Il giorno del piano che vale per la data (o null se il piano non copre quella data).
 * `trained`: se il piano distingue giorni di allenamento e di riposo, sceglie quello giusto.
 */
export function planDayFor(plan: DietPlan | null | undefined, date: string, trained?: boolean): DietDay | null {
  if (!plan || plan.days.length === 0) return null;
  if ((plan.startDate && date < plan.startDate) || (plan.endDate && date > plan.endDate)) return null;
  const idx = weekdayIndex(date);
  const pick = (days: DietDay[]) => days.find((d) => d.weekdays.includes(idx)) ?? days.find((d) => d.weekdays.length === 0);
  const fits = plan.days.filter((d) => trained === undefined || d.training === undefined || d.training === trained);
  return pick(fits) ?? pick(plan.days) ?? null;
}

/** true se il piano ha giorni diversi per allenamento e riposo. */
export const planHasTrainingDays = (plan: DietPlan | null | undefined) => !!plan?.days.some((d) => d.training !== undefined);

/* ---------- acqua ---------- */
export const WATER_DEFAULT_ML = 2000;
export const WATER_STEPS = [250, 500];
export const waterTarget = (plan: DietPlan | null | undefined) => plan?.waterMl ?? WATER_DEFAULT_ML;
export const formatLiters = (ml: number) => `${(ml / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} l`;

/* ---------- pasti salvati ---------- */
const FOOD_KEYS = ['name', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'saltG'] as const;

/** Pasto salvato dai cibi di un pasto del diario. */
export function savedMealFrom(name: string, mealType: MealType, entries: FoodEntry[], id: string): SavedMeal {
  return {
    id, name: name.trim().slice(0, 60) || MEAL_LABEL[mealType], mealType,
    items: entries.map((e) => Object.fromEntries(FOOD_KEYS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]])) as SavedFood)
  };
}

/** Voci del diario per un pasto salvato, nel giorno e nel pasto scelti. */
export function entriesFromSaved(saved: SavedMeal, date: string, mealType: MealType, newId: () => string): FoodEntry[] {
  return saved.items.map((item) => ({ ...item, id: newId(), date, mealType, source: 'manuale' as const }));
}

/* ---------- riepilogo per la nutrizionista ---------- */
export interface ReportDay {
  date: string;
  totals: Totals;
  waterMl: number;
  trained: boolean;
  /** pasti del piano segnati come mangiati, su quelli previsti (null se il piano non c'è) */
  planDone: number | null;
  planTotal: number | null;
  target?: number;
}

export function reportDays(args: { meals: FoodEntry[]; plan: DietPlan | null; water: WaterLog; trainedDates: Set<string>; endDate: string; days?: number }): ReportDay[] {
  const n = args.days ?? 7;
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(args.endDate, i - (n - 1));
    const entries = entriesFor(args.meals, date);
    const trained = args.trainedDates.has(date);
    const day = planDayFor(args.plan, date, planHasTrainingDays(args.plan) ? trained : undefined);
    const eaten = new Set(entries.map((e) => e.planMealId).filter(Boolean));
    return {
      date, totals: totalsOf(entries), waterMl: args.water[date] ?? 0, trained,
      planDone: day ? day.meals.filter((m) => eaten.has(m.id)).length : null,
      planTotal: day ? day.meals.length : null,
      target: targetsFor(args.plan, day).kcal
    };
  });
}

const fmtN = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 0 });
const DAY_NAMES = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/** Testo semplice da mandare alla nutrizionista: totali per giorno e medie dei giorni registrati. */
export function weeklyReportText(days: ReportDay[], plan: DietPlan | null, athlete?: string): string {
  const logged = days.filter((d) => d.totals.kcal > 0);
  const avg = (f: (d: ReportDay) => number) => (logged.length ? logged.reduce((s, d) => s + f(d), 0) / logged.length : 0);
  const [y1, m1, d1] = days[0].date.split('-');
  const [y2, m2, d2] = days.at(-1)!.date.split('-');
  const lines = [
    `Riepilogo alimentazione${athlete ? ` di ${athlete}` : ''}`,
    `Dal ${d1}/${m1}/${y1} al ${d2}/${m2}/${y2}`,
    plan ? `Piano: ${plan.title}${plan.nutritionist ? ` (${plan.nutritionist})` : ''}` : 'Nessun piano inserito',
    ''
  ];
  for (const d of days) {
    const [, m, dd] = d.date.split('-');
    const parts = [`${DAY_NAMES[weekdayIndex(d.date)]} ${dd}/${m}`];
    if (d.totals.kcal > 0) {
      parts.push(`${fmtN(d.totals.kcal)} kcal${d.target ? ` (obiettivo ${fmtN(d.target)})` : ''}`);
      parts.push(`P ${fmtN(d.totals.proteinG)} g · C ${fmtN(d.totals.carbsG)} g · G ${fmtN(d.totals.fatG)} g`);
    } else parts.push('non registrato');
    if (d.waterMl) parts.push(`acqua ${formatLiters(d.waterMl)}`);
    if (d.planTotal) parts.push(`piano ${d.planDone}/${d.planTotal} pasti`);
    if (d.trained) parts.push('allenamento');
    lines.push(`- ${parts.join(' · ')}`);
  }
  lines.push('');
  if (logged.length) {
    lines.push(`${logged.length === 1 ? 'Unico giorno registrato' : `Media dei ${logged.length} giorni registrati`}: ${fmtN(avg((d) => d.totals.kcal))} kcal · P ${fmtN(avg((d) => d.totals.proteinG))} g · C ${fmtN(avg((d) => d.totals.carbsG))} g · G ${fmtN(avg((d) => d.totals.fatG))} g`);
    const withWater = days.filter((d) => d.waterMl > 0);
    if (withWater.length) lines.push(`Acqua media: ${formatLiters(withWater.reduce((s, d) => s + d.waterMl, 0) / withWater.length)} al giorno`);
    const planned = days.reduce((s, d) => s + (d.planTotal ?? 0), 0);
    if (planned) lines.push(`Pasti del piano segnati come mangiati: ${days.reduce((s, d) => s + (d.planDone ?? 0), 0)} su ${planned}`);
  } else lines.push('Nessun pasto registrato in questi giorni.');
  lines.push(`Allenamenti: ${days.filter((d) => d.trained).length}`);
  lines.push('', 'Generato con Ferro. I valori sono quelli inseriti nell\'app.');
  return lines.join('\n');
}

/** Calorie dai macro: 4·proteine + 4·carboidrati + 9·grassi. Undefined se non c'è nessun macro. */
export function kcalFromMacros(p?: number, c?: number, f?: number): number | undefined {
  if (p === undefined && c === undefined && f === undefined) return undefined;
  const k = 4 * (p ?? 0) + 4 * (c ?? 0) + 9 * (f ?? 0);
  return k > 0 ? Math.round(k) : undefined;
}

/** Calorie di un pasto del piano: quelle scritte, altrimenti calcolate dai macro. */
export const mealKcal = (m: Pick<PlanMeal, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>): number | undefined =>
  m.kcal ?? kcalFromMacros(m.proteinG, m.carbsG, m.fatG);

/** true se le calorie del pasto non sono scritte nel piano ma calcolate dai macro. */
export const mealKcalComputed = (m: Pick<PlanMeal, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>) => m.kcal === undefined && mealKcal(m) !== undefined;

export const planKcal = (day: DietDay | null) => (day ? Math.round(day.meals.reduce((s, m) => s + (mealKcal(m) || 0), 0)) : 0);

/** Obiettivo giornaliero: quello scritto nel piano, altrimenti la somma dei pasti del giorno. */
export function targetsFor(plan: DietPlan | null | undefined, day: DietDay | null): { kcal?: number; proteinG?: number; carbsG?: number; fatG?: number } {
  if (!plan) return {};
  return { kcal: plan.kcalTarget ?? (planKcal(day) || kcalFromMacros(plan.proteinG, plan.carbsG, plan.fatG)), proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG };
}

/** Calorie degli ultimi `n` giorni fino a `endDate` compreso, dal più vecchio. */
export function lastDays(entries: FoodEntry[], endDate: string, n = 7): { date: string; kcal: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(endDate, i - (n - 1));
    return { date, kcal: totalsOf(entriesFor(entries, date)).kcal };
  });
}

/** Cibi usati di recente (senza doppioni), per aggiungerli con un tocco. */
export function recentFoods(entries: FoodEntry[], limit = 8): FoodEntry[] {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))) {
    const key = e.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/* ---------- lettura del testo della dieta ---------- */
const MEAL_HEAD = /^\s*(colazione|spuntino(?:\s+(?:di\s+)?(?:metà\s+mattina|mattina|mattino|pomeriggio))?|merenda|pranzo|cena)\b\s*[:\-–]?\s*(.*)$/i;
const DAY_HEAD = /^\s*(lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|giorno\s*\d+)\s*[:\-–]?\s*$/i; // niente \b: non funziona con le lettere accentate
const KCAL = /(\d+(?:[.,]\d+)?)\s*kcal/gi;

function mealKind(label: string, state: { afterLunch: boolean }): MealType {
  const l = label.toLowerCase();
  if (l.startsWith('colazione')) return 'colazione';
  if (l.startsWith('pranzo')) { state.afterLunch = true; return 'pranzo'; }
  if (l.startsWith('cena')) return 'cena';
  if (l.startsWith('merenda') || /pomeriggio/.test(l)) return 'spuntino-pomeriggio';
  if (/mattin|mattina/.test(l)) return 'spuntino-mattina';
  return state.afterLunch ? 'spuntino-pomeriggio' : 'spuntino-mattina';
}

function kcalOf(lines: string[]): number | undefined {
  const text = lines.join('\n');
  const total = text.split('\n').find((l) => /tot(ale)?/i.test(l) && /kcal/i.test(l));
  const source = total ?? text;
  let sum = 0;
  for (const m of source.matchAll(KCAL)) sum += parseNumber(m[1]) ?? 0;
  return sum > 0 ? Math.round(sum) : undefined;
}

/**
 * Legge il testo copiato dal piano della nutrizionista.
 * Riconosce i giorni ("Lunedì"), i pasti ("Colazione: …", "Pranzo", "Merenda") e le calorie ("350 kcal", "Totale 520 kcal").
 */
export function parseDietText(text: string): DietDay[] {
  const days: { title: string; weekdays: number[]; meals: { type: MealType; lines: string[] }[] }[] = [];
  let day: (typeof days)[number] | null = null;
  let meal: (typeof days)[number]['meals'][number] | null = null;
  const state = { afterLunch: false };
  const startDay = (title: string, weekdays: number[]) => {
    day = { title, weekdays, meals: [] };
    days.push(day);
    meal = null;
    state.afterLunch = false;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const d = line.match(DAY_HEAD);
    if (d) {
      const name = d[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const idx = WEEKDAY_NAMES.map((n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).indexOf(name);
      startDay(d[1].charAt(0).toUpperCase() + d[1].slice(1).toLowerCase(), idx >= 0 ? [idx] : []);
      continue;
    }
    const m = line.match(MEAL_HEAD);
    if (m) {
      if (!day) startDay('Ogni giorno', []);
      meal = { type: mealKind(m[1], state), lines: m[2] ? [m[2]] : [] };
      day!.meals.push(meal);
      continue;
    }
    if (meal) meal.lines.push(line);
  }

  return days
    .map((dd, i): DietDay => ({
      id: `giorno-${i + 1}`,
      title: dd.title,
      weekdays: dd.weekdays,
      meals: dd.meals.map((mm, j): PlanMeal => ({
        id: `p${i + 1}-${j + 1}`,
        type: mm.type,
        description: mm.lines.join('\n'),
        kcal: kcalOf(mm.lines)
      }))
    }))
    .filter((dd) => dd.meals.length > 0);
}

/** Nome breve per il diario: prima riga della descrizione, senza le calorie già mostrate a parte. */
export function mealNameFrom(description: string, fallback: string): string {
  const first = description.split('\n')[0] ?? '';
  const cleaned = first
    .replace(/\(\s*\d+(?:[.,]\d+)?\s*kcal\s*\)/gi, '')
    .replace(/\s*[-–]\s*\d+(?:[.,]\d+)?\s*kcal\b/gi, '')
    .replace(/\s*\d+(?:[.,]\d+)?\s*kcal\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:–-]+$/g, '')
    .trim();
  return (cleaned || fallback).slice(0, 80);
}

/* ---------- dieta trascritta da un servizio esterno (formato irontrack-diet-v1) ---------- */

export const DIET_FORMAT = 'irontrack-diet-v1';

export const DIET_PROMPT = `Ti allego il piano alimentare scritto dalla mia nutrizionista (PDF, foto o testo). Devi TRASCRIVERLO nel formato JSON qui sotto, senza interpretarlo né modificarlo.

REGOLE
1. Trascrivi soltanto ciò che è scritto nel documento. Non inventare, non correggere, non calcolare calorie o macro che non sono indicati. Se un dato manca, usa null.
2. Se il piano ha pasti precisi: crea un elemento in "meals" per ogni pasto. In "description" metti gli alimenti con le quantità esattamente come scritti, una riga per alimento (separa le righe con \\n). Le alternative ("oppure", "a scelta") restano nella descrizione.
3. Se il piano indica solo obiettivi (calorie e/o macro al giorno o per pasto) senza alimenti: compila kcalTarget, proteinG, carbsG, fatG. Crea un solo giorno "Ogni giorno" con "weekdays": [] e un pasto per ciascun momento citato, con "description": "Libero, secondo i macro" e i macro del pasto se indicati.
4. Se ci sono sia pasti sia macro, riporta entrambi.
5. Se il piano cambia da un giorno all'altro, crea un elemento in "days" per ogni giorno o gruppo di giorni uguali. "weekdays" usa 0 = lunedì, 1 = martedì … 6 = domenica; [] significa ogni giorno. Se esistono settimane alternate (A/B), titola i giorni "Settimana A - Lunedì" ecc. e segnalalo in "notes".
6. "type" di ogni pasto, solo uno di questi valori: colazione, spuntino-mattina, pranzo, spuntino-pomeriggio, cena, altro.
7. Integratori, consigli generali e avvertenze vanno in "notes". Se il piano indica quanta acqua bere al giorno, mettila in "waterMl" in millilitri (2 litri = 2000), altrimenti null. Tutto ciò che è dubbio o illeggibile: aggiungilo in "notes" iniziando con "DA CONTROLLARE:".
8. Numeri come numeri, con il punto decimale e senza unità (kcal e grammi). Date nel formato AAAA-MM-GG, oppure null.
9. Se i giorni sono numerati (Giorno 1, Giorno 2…) e non legati ai giorni della settimana, assegnali in ordine da lunedì (Giorno 1 = [0], Giorno 2 = [1] …) e scrivilo in "notes".
10. Se il piano distingue i giorni di allenamento da quelli di riposo (es. "giorno ON / OFF", "giorni in cui ti alleni"), crea un giorno per ciascuno con "training": true per l'allenamento e "training": false per il riposo. Se non li distingue, "training": null.
11. Rispondi SOLO con il JSON, dentro un unico blocco di codice, senza commenti prima o dopo.

FORMATO
{
  "format": "${DIET_FORMAT}",
  "title": "Nome del piano",
  "nutritionist": null,
  "startDate": null,
  "endDate": null,
  "kcalTarget": null,
  "proteinG": null,
  "carbsG": null,
  "fatG": null,
  "waterMl": null,
  "notes": null,
  "days": [
    {
      "title": "Lunedì",
      "weekdays": [0],
      "training": null,
      "meals": [
        {
          "type": "colazione",
          "description": "Latte parzialmente scremato 200 ml\\nFette biscottate 30 g",
          "kcal": null,
          "proteinG": null,
          "carbsG": null,
          "fatG": null
        }
      ]
    }
  ]
}`;

/** Primo oggetto JSON `{…}` bilanciato nel testo (ignora frasi attorno e recinti di codice). */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export interface DietParseResult { plan: DietPlan | null; warnings: string[]; error?: string }

/** Legge la risposta incollata dall'utente (formato irontrack-diet-v1). */
export function parseDietJson(text: string): DietParseResult {
  const raw = extractJsonObject(text.replace(/[\u201C\u201D]/g, '"'));
  if (!raw) return { plan: null, warnings: [], error: 'Non trovo nessun JSON nel testo incollato. Incolla la risposta intera del servizio.' };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { plan: null, warnings: [], error: 'Il JSON è incompleto o ha errori (virgole, parentesi). Chiedi al servizio di rispondere di nuovo, solo con il JSON.' };
  }
  if (data.format !== DIET_FORMAT) {
    return { plan: null, warnings: [], error: `Formato non riconosciuto: mi aspetto "format": "${DIET_FORMAT}". Usa il prompt dell'app.` };
  }
  if (!Array.isArray(data.days)) return { plan: null, warnings: [], error: 'Nel JSON manca l\'elenco "days".' };

  const warnings: string[] = [];
  let droppedDays = 0;
  let droppedMeals = 0;
  const unknownTypes = new Set<string>();
  const days = (data.days as unknown[]).filter((d): d is Record<string, unknown> => {
    const ok = !!d && typeof d === 'object' && Array.isArray((d as { meals?: unknown }).meals);
    if (!ok) droppedDays++;
    return ok;
  }).map((d) => ({
    ...d,
    meals: (d.meals as unknown[]).filter((m): m is Record<string, unknown> => {
      const ok = !!m && typeof m === 'object';
      if (!ok) droppedMeals++;
      return ok;
    }).map((m) => {
      if (!MEAL_TYPES.includes(m.type as MealType)) unknownTypes.add(String(m.type));
      return m;
    })
  }));
  if (droppedDays) warnings.push(`${droppedDays} ${droppedDays === 1 ? 'giorno scartato perché senza' : 'giorni scartati perché senza'} pasti validi.`);
  if (droppedMeals) warnings.push(`${droppedMeals} ${droppedMeals === 1 ? 'pasto scartato' : 'pasti scartati'} perché non validi.`);
  if (unknownTypes.size) warnings.push(`Tipi di pasto non riconosciuti (${[...unknownTypes].join(', ')}): li ho messi in “Altro”.`);

  const plan = normalizeDietPlan({ ...data, days, updatedAt: new Date().toISOString() });
  if (!plan || plan.days.length === 0) return { plan: null, warnings, error: 'Il JSON non contiene giorni con pasti.' };
  if (typeof data.notes === 'string' && /DA CONTROLLARE/i.test(data.notes)) warnings.push('Il servizio ha segnalato dati da controllare: leggi le indicazioni in “Indicazioni della nutrizionista”.');
  for (const d of plan.days) {
    for (const m of d.meals) {
      if (mealKcalComputed(m)) { warnings.push('Alcune calorie sono calcolate dai macro (4·P + 4·C + 9·G), non scritte nel piano.'); return { plan, warnings }; }
    }
  }
  return { plan, warnings };
}
