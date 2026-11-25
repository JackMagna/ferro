import type { FoodEntry, WorkoutSession } from '../types';
import { workoutNotes } from '../lib/workoutKind';
import { nutritionDataPoint } from '../lib/healthNutrition';
import { estimateCalories, isoDay, mergeBody, summarizeHeartRate, type BodyEntry } from '../lib/healthMath';
import { GoogleTokenExpiredError } from './firebase';

/**
 * Google Health API (v4): sostituisce le vecchie API Fitbit, che vengono spente il 30 ottobre 2026.
 * Funziona dal sito con il login Google, senza registrare nessuna app esterna.
 * Documentazione: https://developers.google.com/health
 */
const BASE = 'https://health.googleapis.com/v4/users/me';

export class HealthNotLinkedError extends Error {
  constructor() {
    super('Il tuo account Google non ha un profilo Google Health collegato. Apri l\'app Google Health sul telefono, tocca "Accedi con Google" e scegli questo account (o migra l\'account Fitbit), poi riprova.');
    this.name = 'HealthNotLinkedError';
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
  if (res.ok) return (await res.json().catch(() => ({}))) as T;
  const body = await res.json().catch(() => null);
  const status = body?.error?.status as string | undefined;
  const message = body?.error?.message ?? res.statusText;
  if (res.status === 401) throw new GoogleTokenExpiredError();
  if (res.status === 400 && /ACCOUNT_NOT_LINKED/i.test(`${status} ${message} ${JSON.stringify(body)}`)) throw new HealthNotLinkedError();
  // il motivo di Google (permesso mancante, API non attiva…) serve a capire cosa non va
  if (res.status === 403) throw new Error(`Google Health ha negato l'accesso. Ricollega Google Health e accetta tutti i permessi richiesti.${message ? ` (Google: ${message})` : ''}`);
  if (res.status === 429) throw new Error('Google Health ha limitato le richieste: riprova tra qualche minuto.');
  throw new Error(`Errore Google Health (${res.status}): ${message}`);
}

/** Controlla che l'account Google abbia un profilo Google Health attivo. */
export const checkLinked = (token: string) => call<unknown>(token, '/identity');

/* ---------- tempi ---------- */
const offsetSeconds = (ms: number) => `${-new Date(ms).getTimezoneOffset() * 60}s`;
const sampleTime = (ms: number) => ({ physicalTime: new Date(ms).toISOString(), utcOffset: offsetSeconds(ms) });
const noonOf = (date: string) => new Date(`${date}T12:00:00`).getTime();

interface SampleTime { physicalTime?: string; utcOffset?: string; civilTime?: { date?: { year: number; month: number; day: number } } }

/** Giorno (locale dell'utente) di un campione: usa l'ora civile se c'è, altrimenti ora fisica + offset. */
export function civilDay(t: SampleTime | undefined): string | null {
  const d = t?.civilTime?.date;
  if (d?.year && d.month && d.day) return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  if (!t?.physicalTime) return null;
  const offset = Number.parseInt(t.utcOffset ?? '0', 10) || 0;
  return new Date(Date.parse(t.physicalTime) + offset * 1000).toISOString().slice(0, 10);
}

/* ---------- lettura ---------- */
interface Page<T> { dataPoints?: T[]; nextPageToken?: string }

async function listAll<T>(token: string, dataType: string, filter: string, pageSize: number, maxPages = 5): Promise<T[]> {
  const out: T[] = [];
  let pageToken = '';
  for (let i = 0; i < maxPages; i++) {
    const q = new URLSearchParams({ filter, pageSize: String(pageSize), ...(pageToken ? { pageToken } : {}) });
    const page = await call<Page<T>>(token, `/dataTypes/${dataType}/dataPoints?${q}`);
    out.push(...(page.dataPoints ?? []));
    pageToken = page.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return out;
}

const window = (field: string, from: number, to: number) =>
  `${field}.sample_time.physical_time >= "${new Date(from).toISOString()}" AND ${field}.sample_time.physical_time < "${new Date(to).toISOString()}"`;

/** Pesate e massa grassa degli ultimi `days` giorni, una per giorno. */
export async function fetchBody(token: string, days = 30): Promise<BodyEntry[]> {
  const to = Date.now() + 86_400_000;
  const from = Date.now() - days * 86_400_000;
  const [w, f] = await Promise.all([
    listAll<{ weight?: { sampleTime?: SampleTime; weightGrams?: number } }>(token, 'weight', window('weight', from, to), 1000),
    listAll<{ bodyFat?: { sampleTime?: SampleTime; percentage?: number } }>(token, 'body-fat', window('bodyFat', from, to), 1000)
  ]);
  const weights = w.flatMap((p) => {
    const date = civilDay(p.weight?.sampleTime);
    return date && p.weight?.weightGrams ? [{ date, weight: p.weight.weightGrams / 1000 }] : [];
  });
  const fats = f.flatMap((p) => {
    const date = civilDay(p.bodyFat?.sampleTime);
    return date && p.bodyFat?.percentage !== undefined ? [{ date, fat: p.bodyFat.percentage }] : [];
  });
  // le risposte arrivano dalla più recente: mergeBody tiene l'ultimo valore del giorno, quindi si inverte
  return mergeBody(weights.reverse(), fats.reverse());
}

/** Frequenza cardiaca media e massima nella finestra dell'allenamento. */
export async function fetchHeartRate(token: string, session: Pick<WorkoutSession, 'startedAt' | 'endedAt'>): Promise<{ avg: number; max: number } | null> {
  const points = await listAll<{ heartRate?: { sampleTime?: SampleTime; beatsPerMinute?: string } }>(
    token, 'heart-rate', window('heartRate', session.startedAt, session.endedAt), 10_000, 3
  );
  return summarizeHeartRate(points.flatMap((p) => (p.heartRate?.beatsPerMinute ? [{ time: p.heartRate.sampleTime?.physicalTime ?? '', value: Number(p.heartRate.beatsPerMinute) }] : [])));
}

/* ---------- scrittura ---------- */
/** Risposta della create: una Operation (`done`, `response`) oppure, in alcuni casi, direttamente il data point. */
interface CreateResult { name?: string; done?: boolean; response?: { name?: string }; error?: { message?: string } }

const create = (token: string, dataType: string, dataPoint: object) =>
  call<CreateResult>(token, `/dataTypes/${dataType}/dataPoints`, { method: 'POST', body: JSON.stringify(dataPoint) });

/**
 * Nome del data point creato. In una Operation `name` è il nome dell'operazione, non quello del dato:
 * l'id giusto è in `response.name`. Se non c'è `done`, la risposta è il data point stesso.
 */
export function dataPointName(res: CreateResult): string {
  if (res.error?.message) throw new Error(`Google Health non ha salvato il dato: ${res.error.message}`);
  if (res.response?.name) return res.response.name;
  return res.done === undefined ? res.name ?? '' : '';
}

/** Salva peso e/o massa grassa alla data della misura (mezzogiorno locale). */
export async function writeBody(token: string, entry: BodyEntry): Promise<void> {
  const t = sampleTime(noonOf(entry.date));
  if (entry.weightKg !== undefined) await create(token, 'weight', { weight: { sampleTime: t, weightGrams: Math.round(entry.weightKg * 1000) } });
  if (entry.bodyFat !== undefined) await create(token, 'body-fat', { bodyFat: { sampleTime: t, percentage: entry.bodyFat } });
}

/** Corpo della richiesta per registrare l'allenamento come "allenamento di forza". */
export function exerciseDataPoint(session: WorkoutSession, weightKg?: number) {
  const start = session.startedAt;
  const end = Math.max(session.endedAt, start + 60_000);
  const seconds = Math.round((end - start) / 1000);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return {
    exercise: {
      interval: { startTime: new Date(start).toISOString(), startUtcOffset: offsetSeconds(start), endTime: new Date(end).toISOString(), endUtcOffset: offsetSeconds(end) },
      exerciseType: 'STRENGTH_TRAINING',
      displayName: session.dayTitle || 'Allenamento',
      activeDuration: `${seconds}s`,
      notes: workoutNotes(session),
      metricsSummary: {
        caloriesKcal: estimateCalories({ minutes, avgBpm: session.avgBpm, weightKg }),
        ...(session.avgBpm ? { averageHeartRateBeatsPerMinute: String(Math.round(session.avgBpm)) } : {})
      }
    }
  };
}

export async function logWorkout(token: string, session: WorkoutSession, weightKg?: number): Promise<string> {
  return dataPointName(await create(token, 'exercise', exerciseDataPoint(session, weightKg)));
}

/* ---------- pasti ---------- */

/** Registra un pasto e restituisce il nome del data point (serve per modificarlo o eliminarlo). */
export async function writeMeal(token: string, entry: FoodEntry): Promise<string> {
  try {
    return dataPointName(await create(token, 'nutrition-log', nutritionDataPoint(entry)));
  } catch (err) {
    // il valore di mealType non è tra quelli verificati: se Google lo rifiuta si riprova senza
    if (nutritionDataPoint(entry).nutritionLog.mealType && err instanceof Error && /\(400\)/.test(err.message) && /meal/i.test(err.message)) {
      return dataPointName(await create(token, 'nutrition-log', nutritionDataPoint(entry, false)));
    }
    throw err;
  }
}

/** Elimina dei pasti già inviati. Un pasto che non esiste più su Google Health non è un errore. */
export async function deleteMeals(token: string, names: string[]): Promise<void> {
  const list = [...new Set(names.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    try {
      await call<unknown>(token, '/dataTypes/nutrition-log/dataPoints:batchDelete', { method: 'POST', body: JSON.stringify({ names: list.slice(i, i + 50) }) });
    } catch (err) {
      if (!(err instanceof Error && /\(404\)/.test(err.message))) throw err;
    }
  }
}

export { isoDay };
