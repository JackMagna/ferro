import type { BlockFormat, DietDay, DietPlan, FoodEntry, Measurement, MealType, PlanMeal, ProgramBlock, ProgramExercise, ScoreKind, SavedFood, SavedMeal, WaterLog, WorkoutProgram, WorkoutSession } from '../types';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import { volumeOf } from '../lib/stats';

type Loose = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

/**
 * Converte una sessione salvata (anche dalla versione precedente dell'app,
 * che usava `completedSets` e `sessionId`) nel formato attuale.
 */
export function normalizeSession(raw: Loose, fallbackId?: string): WorkoutSession {
  const rawSets = (Array.isArray(raw.sets) ? raw.sets : Array.isArray(raw.completedSets) ? raw.completedSets : []) as Loose[];
  const sets = rawSets.map((s) => ({
    exerciseId: str(s.exerciseId),
    exerciseName: str(s.exerciseName, 'Esercizio'),
    setIndex: num(s.setIndex),
    weightKg: num(s.weightKg),
    reps: num(s.reps),
    ...(posNum(s.durationSec) ? { durationSec: posNum(s.durationSec) } : {}),
    ...(posNum(s.distanceM) ? { distanceM: posNum(s.distanceM) } : {})
  }));
  const blockResults = (Array.isArray(raw.blockResults) ? raw.blockResults : []) as Loose[];
  const date = str(raw.date) || str(raw.createdAt).slice(0, 10) || new Date().toISOString().slice(0, 10);
  const durationMinutes = num(raw.durationMinutes, 0);
  const endedAt = num(raw.endedAt) || Date.parse(str(raw.createdAt)) || Date.parse(`${date}T12:00:00`);
  const startedAt = num(raw.startedAt) || endedAt - durationMinutes * 60000;
  return {
    id: str(raw.id) || str(raw.sessionId) || fallbackId || `s-${startedAt}`,
    date,
    startedAt,
    endedAt,
    dayId: str(raw.dayId),
    dayTitle: str(raw.dayTitle, 'Allenamento'),
    weekNumber: num(raw.weekNumber, 1),
    durationMinutes,
    totalVolumeKg: num(raw.totalVolumeKg) || volumeOf(sets),
    sets,
    ...(blockResults.length
      ? {
          blockResults: blockResults.map((b) => ({
            blockId: str(b.blockId),
            title: str(b.title, 'Blocco'),
            kind: SCORES.includes(b.kind as never) ? (b.kind as ScoreKind) : 'fatto',
            timeSec: posNum(b.timeSec),
            rounds: posNum(b.rounds),
            reps: posNum(b.reps),
            rx: b.rx === undefined ? undefined : !!b.rx,
            notes: str(b.notes) || undefined
          }))
        }
      : {}),
    avgBpm: raw.avgBpm === undefined ? undefined : num(raw.avgBpm),
    maxBpm: raw.maxBpm === undefined ? undefined : num(raw.maxBpm),
    sheetsSynced: raw.sheetsSynced === undefined ? undefined : !!raw.sheetsSynced,
    healthSynced: raw.healthSynced === undefined ? undefined : !!raw.healthSynced,
    healthLogId: str(raw.healthLogId) || undefined
  };
}

export function normalizeMeasurement(raw: Loose, fallbackId?: string): Measurement {
  const opt = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : num(v));
  return {
    id: str(raw.id) || fallbackId || `m-${Date.now()}`,
    date: str(raw.date) || new Date().toISOString().slice(0, 10),
    week: opt(raw.week),
    weightKg: opt(raw.weightKg),
    bodyFat: opt(raw.bodyFat),
    chestCm: opt(raw.chestCm),
    waistCm: opt(raw.waistCm),
    abdomenCm: opt(raw.abdomenCm),
    hipsCm: opt(raw.hipsCm),
    armsCm: opt(raw.armsCm),
    thighsCm: opt(raw.thighsCm),
    notes: str(raw.notes) || undefined,
    sheetsSynced: raw.sheetsSynced === undefined ? undefined : !!raw.sheetsSynced,
    healthSynced: raw.healthSynced === undefined ? undefined : !!raw.healthSynced,
    source: str(raw.source) || undefined
  };
}

/** Valida una scheda letta da storage/cloud; se non è valida usa quella di partenza. */
const ACTIVITIES = ['forza', 'corsa', 'bici', 'nuoto', 'vogatore', 'ellittica', 'camminata', 'pilates', 'mobilita', 'altro'];
const FORMATS = ['superset', 'circuito', 'amrap', 'emom', 'for_time', 'intervalli', 'gara'];
const SCORES = ['tempo', 'giri_rip', 'rip', 'carico', 'fatto'];
const posNum = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : num(v) || undefined);

function normalizeBlock(b: Partial<ProgramBlock>, fallbackId: string): ProgramBlock {
  return {
    id: str(b.id, fallbackId),
    format: FORMATS.includes(b.format as never) ? (b.format as BlockFormat) : 'circuito',
    title: str(b.title) || undefined,
    rounds: posNum(b.rounds),
    durationSec: posNum(b.durationSec),
    everySec: posNum(b.everySec),
    workSec: posNum(b.workSec),
    restSec: posNum(b.restSec),
    timeCapSec: posNum(b.timeCapSec),
    score: SCORES.includes(b.score as never) ? (b.score as ScoreKind) : undefined,
    rawText: str(b.rawText) || undefined
  };
}

export function normalizeProgram(raw: unknown): WorkoutProgram {
  const p = raw as Partial<WorkoutProgram> | null;
  if (!p || !Array.isArray(p.days) || p.days.length === 0) return structuredClone(DEFAULT_PROGRAM);
  const totalWeeks = Math.min(16, Math.max(1, num(p.totalWeeks, 6)));
  return {
    title: str(p.title, DEFAULT_PROGRAM.title),
    athlete: str(p.athlete),
    trainer: str(p.trainer),
    totalWeeks,
    updatedAt: p.updatedAt,
    startDate: str(p.startDate) || undefined,
    source: p.source?.tab
      ? {
          tab: String(p.source.tab),
          measuresTab: p.source.measuresTab ? String(p.source.measuresTab) : undefined,
          annotate: !!p.source.annotate,
          fingerprint: p.source.fingerprint ? String(p.source.fingerprint) : undefined,
          weekCols: Object.fromEntries(Object.entries(p.source.weekCols ?? {}).map(([k, v]) => [Number(k), Number(v)]))
        }
      : undefined,
    guidelines: {
      modalitaEsecuzione: Array.isArray(p.guidelines?.modalitaEsecuzione) ? p.guidelines!.modalitaEsecuzione.map(String) : [],
      progressione: str(p.guidelines?.progressione),
      cedimento: str(p.guidelines?.cedimento)
    },
    days: p.days.map((d, di) => ({
      id: str(d.id, `giorno-${di + 1}`),
      title: str(d.title, `Giorno ${di + 1}`),
      subtitle: str(d.subtitle) || undefined,
      exercises: (Array.isArray(d.exercises) ? d.exercises : []).map((e: Partial<ProgramExercise>, ei) => ({
        id: str(e.id, `ex-${di + 1}-${ei + 1}`),
        name: str(e.name, 'Esercizio'),
        libraryId: str(e.libraryId) || undefined,
        linkedBy: e.linkedBy === 'utente' || e.linkedBy === 'comunita' ? e.linkedBy : undefined,
        note: str(e.note) || undefined,
        warmupNote: str(e.warmupNote) || undefined,
        sectionType: e.sectionType === 'cedimento' || e.sectionType === 'core' ? e.sectionType : 'progressione',
        restTimeSec: Math.max(0, num(e.restTimeSec, 120)),
        sheetRow: e.sheetRow ? num(e.sheetRow) : undefined,
        cellMode: e.cellMode === 'loads' ? 'loads' : undefined,
        activity: ACTIVITIES.includes(e.activity as never) ? e.activity : undefined,
        blockId: str(e.blockId) || undefined,
        weeks: Object.fromEntries(Object.entries(e.weeks ?? {}).map(([k, v]) => [Number(k), String(v)]))
      })),
      ...(Array.isArray(d.blocks) && d.blocks.length ? { blocks: d.blocks.map((b: Partial<ProgramBlock>, bi) => normalizeBlock(b, `b-${di + 1}-${bi + 1}`)) } : {})
    }))
  };
}

const MEALS: MealType[] = ['colazione', 'spuntino-mattina', 'pranzo', 'spuntino-pomeriggio', 'cena', 'altro'];
const optNum = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : num(v));
const mealType = (v: unknown): MealType => (MEALS.includes(v as MealType) ? (v as MealType) : 'altro');

export function normalizeMeal(raw: Loose, fallbackId?: string): FoodEntry {
  return {
    id: str(raw.id) || fallbackId || `meal-${Date.now()}`,
    date: str(raw.date) || new Date().toISOString().slice(0, 10),
    mealType: mealType(raw.mealType),
    name: str(raw.name, 'Pasto'),
    kcal: Math.max(0, num(raw.kcal)),
    proteinG: optNum(raw.proteinG),
    carbsG: optNum(raw.carbsG),
    fatG: optNum(raw.fatG),
    notes: str(raw.notes) || undefined,
    planMealId: str(raw.planMealId) || undefined,
    eatenAt: typeof raw.eatenAt === 'number' && Number.isFinite(raw.eatenAt) && raw.eatenAt > 0 ? raw.eatenAt : undefined,
    fiberG: optNum(raw.fiberG),
    sugarG: optNum(raw.sugarG),
    saltG: optNum(raw.saltG),
    barcode: /^\d{6,14}$/.test(str(raw.barcode)) ? str(raw.barcode) : undefined,
    nutriScore: ['a', 'b', 'c', 'd', 'e'].includes(str(raw.nutriScore).toLowerCase()) ? (str(raw.nutriScore).toLowerCase() as FoodEntry['nutriScore']) : undefined,
    nova: [1, 2, 3, 4].includes(Number(raw.nova)) ? (Number(raw.nova) as FoodEntry['nova']) : undefined,
    source: raw.source === 'manuale' || raw.source === 'piano' || raw.source === 'openfoodfacts' || raw.source === 'tabella' ? raw.source : undefined,
    healthSynced: typeof raw.healthSynced === 'boolean' ? raw.healthSynced : undefined,
    healthLogId: str(raw.healthLogId) || undefined
  };
}

/** Valida il piano letto da storage/cloud: se non è valido restituisce null (nessuna dieta). */
export function normalizeDietPlan(raw: unknown): DietPlan | null {
  const p = raw as Partial<DietPlan> | null;
  if (!p || typeof p !== 'object' || !Array.isArray(p.days)) return null;
  return {
    title: str(p.title, 'Piano alimentare'),
    nutritionist: str(p.nutritionist) || undefined,
    startDate: str(p.startDate) || undefined,
    endDate: str(p.endDate) || undefined,
    kcalTarget: optNum(p.kcalTarget),
    proteinG: optNum(p.proteinG),
    carbsG: optNum(p.carbsG),
    fatG: optNum(p.fatG),
    waterMl: optNum(p.waterMl),
    notes: str(p.notes) || undefined,
    updatedAt: str(p.updatedAt) || undefined,
    days: p.days.map((d: Partial<DietDay>, i): DietDay => ({
      id: str(d.id, `giorno-${i + 1}`),
      title: str(d.title, `Giorno ${i + 1}`),
      weekdays: (Array.isArray(d.weekdays) ? d.weekdays : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      training: typeof d.training === 'boolean' ? d.training : undefined,
      meals: (Array.isArray(d.meals) ? d.meals : []).map((m: Partial<PlanMeal>, j): PlanMeal => ({
        id: str(m.id, `p${i + 1}-${j + 1}`),
        type: mealType(m.type),
        description: str(m.description),
        kcal: optNum(m.kcal),
        proteinG: optNum(m.proteinG),
        carbsG: optNum(m.carbsG),
        fatG: optNum(m.fatG)
      }))
    }))
  };
}

/** Pasti salvati letti da storage/cloud: scarta quelli senza alimenti. */
export function normalizeSavedMeals(raw: unknown): SavedMeal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Loose => !!s && typeof s === 'object' && Array.isArray((s as Loose).items))
    .map((s, i) => ({
      id: str(s.id) || `pasto-${i + 1}`,
      name: str(s.name, 'Pasto salvato'),
      mealType: mealType(s.mealType),
      items: (s.items as Loose[]).filter((x) => !!x && typeof x === 'object').map((x): SavedFood => ({
        name: str(x.name, 'Alimento'),
        kcal: Math.max(0, num(x.kcal)),
        proteinG: optNum(x.proteinG),
        carbsG: optNum(x.carbsG),
        fatG: optNum(x.fatG),
        fiberG: optNum(x.fiberG),
        sugarG: optNum(x.sugarG),
        saltG: optNum(x.saltG)
      }))
    }))
    .filter((s) => s.items.length > 0);
}

/** Acqua bevuta: tiene solo date valide e quantità positive (al massimo 20 litri). */
export function normalizeWater(raw: unknown): WaterLog {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Loose)
      .filter(([date, ml]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && num(ml) > 0)
      .map(([date, ml]) => [date, Math.min(20_000, Math.round(num(ml)))])
  );
}
