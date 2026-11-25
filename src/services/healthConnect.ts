import { Capacitor, registerPlugin } from '@capacitor/core';
import { workoutKind, workoutNotes, type WorkoutKind } from '../lib/workoutKind';
import type { HealthSample } from '@capgo/capacitor-health';
import type { WatchWorkout } from '../lib/watchImport';
import type { FoodEntry, WorkoutSession } from '../types';
import { isoDay, mergeBody, summarizeHeartRate, type BodyEntry } from '../lib/healthMath';
import { mealInterval } from '../lib/nutrition';
import { readJSON, writeJSON } from '../lib/storage';
import { notifyHealth } from './health';
import { t } from '../lib/i18n';

/**
 * Health Connect (Android): funziona solo dentro l'app Android, non dal sito.
 * Il plugin viene caricato solo quando serve, così la versione web non lo scarica.
 */
const KEY = 'irontrack:hc-connected';
const READ = ['weight', 'bodyFat', 'heartRate', 'calories'] as const;
// dietaryEnergyConsumed = calorie dei pasti (il plugin non passa i macro), dietaryWater = acqua bevuta
const WRITE = ['weight', 'bodyFat', 'dietaryEnergyConsumed', 'dietaryWater'] as const;

export function isAndroidApp(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

const plugin = async () => (await import('@capgo/capacitor-health')).Health;

export const isHealthConnectConnected = () => isAndroidApp() && readJSON<boolean>(KEY, false);

export async function connectHealthConnect(): Promise<void> {
  if (!isAndroidApp()) throw new Error(t("Health Connect è disponibile solo nell'app Android, non dal sito."));
  const Health = await plugin();
  const availability = await Health.isAvailable();
  if (!availability.available) {
    throw new Error(availability.reason ?? t('Health Connect non è disponibile. Installalo dal Play Store (“Health Connect by Android”).'));
  }
  const status = await Health.requestAuthorization({ read: [...READ], write: [...WRITE] });
  if (!status.readAuthorized.includes('weight') && !status.readAuthorized.includes('heartRate')) {
    throw new Error(t("Non hai concesso nessun permesso di lettura. Riprova e consenti l'accesso a peso e frequenza cardiaca."));
  }
  writeJSON(KEY, true);
  notifyHealth();
}

export function disconnectHealthConnect() {
  // i permessi si revocano dalle impostazioni di Health Connect: qui si smette solo di usarli
  writeJSON(KEY, false);
  notifyHealth();
}

export async function openHealthConnectSettings() {
  await (await plugin()).openHealthConnectSettings();
}

/* ---------- conversioni (testate senza telefono) ---------- */
type Sample = Pick<HealthSample, 'value' | 'startDate'>;

export function samplesToBody(weights: Sample[], fats: Sample[]): BodyEntry[] {
  const day = (s: Sample) => isoDay(Date.parse(s.startDate));
  const byTime = (a: Sample, b: Sample) => Date.parse(a.startDate) - Date.parse(b.startDate);
  return mergeBody(
    [...weights].sort(byTime).map((s) => ({ date: day(s), weight: s.value })),
    [...fats].sort(byTime).map((s) => ({ date: day(s), fat: s.value }))
  );
}

export function samplesToHeartRate(samples: Sample[]): { avg: number; max: number } | null {
  return summarizeHeartRate(samples.map((s) => ({ time: s.startDate, value: s.value })));
}

/* ---------- operazioni ---------- */
const range = (from: number, to: number) => ({ startDate: new Date(from).toISOString(), endDate: new Date(to).toISOString() });

export async function readBody(days = 30): Promise<BodyEntry[]> {
  const Health = await plugin();
  const q = range(Date.now() - days * 86_400_000, Date.now());
  const [w, f] = await Promise.all([
    Health.readSamples({ dataType: 'weight', ...q, limit: 200 }),
    Health.readSamples({ dataType: 'bodyFat', ...q, limit: 200 }).catch(() => ({ samples: [] as HealthSample[] }))
  ]);
  return samplesToBody(w.samples, f.samples);
}

export async function readHeartRate(session: WorkoutSession): Promise<{ avg: number; max: number } | null> {
  const Health = await plugin();
  const { samples } = await Health.readSamples({ dataType: 'heartRate', ...range(session.startedAt, session.endedAt), limit: 2000 });
  return samplesToHeartRate(samples);
}

/** Calorie del pasto (Health Connect non permette di modificarle o cancellarle da qui). */
export async function writeMeal(entry: Pick<FoodEntry, 'date' | 'mealType' | 'eatenAt' | 'kcal'>): Promise<void> {
  if (!(entry.kcal > 0)) return;
  const { startMs, endMs } = mealInterval(entry);
  await (await plugin()).saveSample({ dataType: 'dietaryEnergyConsumed', value: entry.kcal, ...range(startMs, endMs) });
}

/** Acqua bevuta, in millilitri, nell'istante indicato. */
export async function writeWater(ml: number, at = Date.now()): Promise<void> {
  if (!(ml > 0)) return;
  await (await plugin()).saveSample({ dataType: 'dietaryWater', value: ml / 1000, ...range(at, at + 60_000) });
}

/** Somma delle calorie bruciate con l'attività nel giorno (AAAA-MM-GG), senza doppioni tra app. Null se non ci sono dati. */
export async function readActiveCalories(date: string): Promise<number | null> {
  const start = new Date(`${date}T00:00:00`).getTime();
  const { samples } = await (await plugin()).queryAggregated({ dataType: 'calories', ...range(start, start + 86_400_000), bucket: 'day', aggregation: 'sum' });
  const total = samples.reduce((s, x) => s + (x.value || 0), 0);
  return total > 0 ? Math.round(total) : null;
}

/* ---------- allenamenti: li scrive il plugin nativo di Ferro (FerroWorkoutPlugin / HealthWorkout.java) ---------- */
interface FerroHealthWorkout {
  requestHealthWorkout(): Promise<{ granted: boolean }>;
  /** type: vedi lib/workoutKind.ts (le versioni vecchie dell'app lo ignorano e salvano «forza») */
  saveHealthWorkout(o: { id: string; start: number; end: number; title: string; notes?: string; type?: WorkoutKind; distance?: number }): Promise<void>;
}
const ferro = registerPlugin<FerroHealthWorkout>('FerroWorkout');

/** Chiede a Health Connect il permesso di salvare gli allenamenti. */
export async function requestWorkoutPermission(): Promise<boolean> {
  if (!isAndroidApp() || !Capacitor.isPluginAvailable('FerroWorkout')) return false;
  return (await ferro.requestHealthWorkout()).granted;
}

/** Salva l'allenamento con il suo tipo (forza, bici, nuoto, pilates…), una volta: Health Connect lo riconosce dall'id di Ferro. */
export async function writeWorkout(s: WorkoutSession): Promise<void> {
  if (!Capacitor.isPluginAvailable('FerroWorkout')) throw new Error(t("Aggiorna l'app Android di Ferro per salvare gli allenamenti in Health Connect."));
  await ferro.saveHealthWorkout({
    id: s.id,
    start: s.startedAt,
    end: s.endedAt,
    title: s.dayTitle || 'Allenamento',
    notes: workoutNotes(s),
    type: workoutKind(s),
    // metri della seduta (corsa, bici, nuoto…): le versioni vecchie dell'app la ignorano
    distance: Math.round(s.sets.reduce((t, x) => t + (x.distanceM ?? 0), 0))
  });
}

/** Salva peso e massa grassa alla data della misura (mezzogiorno locale). */
export async function writeBody(entry: BodyEntry): Promise<void> {
  const Health = await plugin();
  const startDate = new Date(`${entry.date}T12:00:00`).toISOString();
  if (entry.weightKg !== undefined) await Health.saveSample({ dataType: 'weight', value: entry.weightKg, startDate });
  if (entry.bodyFat !== undefined) await Health.saveSample({ dataType: 'bodyFat', value: entry.bodyFat, startDate });
}

/* ---------- attività dell'orologio (lette da Health Connect) ---------- */

/**
 * Allenamenti degli ultimi giorni registrati da altre app (orologio, Strava, Samsung Health…), con la loro distanza.
 * Chiede i permessi di lettura solo adesso, al primo tocco su «Importa dall'orologio».
 */
export async function readWatchWorkouts(days = 14): Promise<WatchWorkout[]> {
  if (!isAndroidApp()) throw new Error(t("L'import dall'orologio funziona solo nell'app Android, con Health Connect."));
  const Health = await plugin();
  const status = await Health.requestAuthorization({ read: ['workouts', 'distance', 'heartRate'], write: [] });
  if (!status.readAuthorized.includes('workouts')) {
    throw new Error(t('Serve il permesso di Health Connect per leggere gli allenamenti. Riprova e consenti «Esercizio».'));
  }
  const { workouts } = await Health.queryWorkouts({ ...range(Date.now() - days * 86_400_000, Date.now()), limit: 100, ascending: false });
  return workouts;
}
