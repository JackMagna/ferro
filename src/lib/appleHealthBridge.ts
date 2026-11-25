import type { FoodEntry, Measurement } from '../types';
import { mealInterval } from './nutrition';

/**
 * Ponte verso Apple Salute con i Comandi rapidi di iPhone (Fase 10A).
 * Salute non ha un'API web: Ferro prepara i dati e apre il Comando rapido «Ferro Salute»,
 * che li registra con l'azione «Registra campione di salute». Al contrario, il Comando
 * «Salute Ferro» legge le pesate da Salute e apre Ferro con ?salute=… per importarle.
 *
 * Formato (testo JSON), un elenco per tipo così il Comando non deve fare scelte:
 * { "v": 1, "peso": [{ "v": 104.5, "d": "2026-10-27 12:00" }], "grasso": [...], "kcal": [...],
 *   "proteine": [...], "carboidrati": [...], "grassi": [...] }
 * peso in kg, grasso in %, kcal, macro in grammi; "d" è data e ora locali.
 */
export const SHORTCUT_TO_HEALTH = 'Ferro Salute';
export const SHORTCUT_FROM_HEALTH = 'Salute Ferro';
/** Massimo di valori per ogni invio: il testo passato al Comando rapido non deve diventare troppo lungo. */
export const MAX_PER_SEND = 60;

export type AppleKind = 'peso' | 'grasso' | 'kcal' | 'proteine' | 'carboidrati' | 'grassi';
export interface AppleValue { v: number; d: string }
export type ApplePayload = { v: 1 } & Partial<Record<AppleKind, AppleValue[]>>;

const pad = (n: number) => String(n).padStart(2, '0');
/** Data e ora locali nel formato che i Comandi rapidi riconoscono: "AAAA-MM-GG HH:MM". */
export function localStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const noon = (date: string) => `${date} 12:00`;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Chiavi dei dati già inviati, per non mandarli due volte. */
export const measurementKey = (m: Pick<Measurement, 'id'>) => `m:${m.id}`;
export const mealKey = (m: Pick<FoodEntry, 'id'>) => `f:${m.id}`;

/**
 * Dati nuovi da mandare a Salute: pesate e massa grassa, calorie e macro dei pasti.
 * Le misure arrivate da Apple Salute non vengono rimandate indietro.
 */
export function pendingForApple(measurements: Measurement[], meals: FoodEntry[], sent: Set<string>, limit = MAX_PER_SEND): { payload: ApplePayload; keys: string[]; total: number } {
  type Item = { key: string; add: (p: ApplePayload) => number };
  const push = (p: ApplePayload, kind: AppleKind, v: number | undefined, d: string) => {
    if (v === undefined || !Number.isFinite(v) || v <= 0) return 0;
    (p[kind] ??= []).push({ v: round1(v), d });
    return 1;
  };
  const items: Item[] = [
    ...measurements
      .filter((m) => !sent.has(measurementKey(m)) && m.source !== 'Apple Salute' && (m.weightKg !== undefined || m.bodyFat !== undefined))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m): Item => ({ key: measurementKey(m), add: (p) => push(p, 'peso', m.weightKg, noon(m.date)) + push(p, 'grasso', m.bodyFat, noon(m.date)) })),
    ...meals
      .filter((m) => !sent.has(mealKey(m)) && m.kcal > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m): Item => {
        const d = localStamp(mealInterval(m).startMs);
        return { key: mealKey(m), add: (p) => push(p, 'kcal', m.kcal, d) + push(p, 'proteine', m.proteinG, d) + push(p, 'carboidrati', m.carbsG, d) + push(p, 'grassi', m.fatG, d) };
      })
  ];
  const payload: ApplePayload = { v: 1 };
  const keys: string[] = [];
  let values = 0;
  for (const item of items) {
    if (keys.length && values >= limit) break;
    values += item.add(payload);
    keys.push(item.key);
  }
  return { payload, keys, total: items.length };
}

/** Indirizzo che apre il Comando rapido passandogli il testo. */
export const shortcutUrl = (name: string, text?: string) =>
  `shortcuts://run-shortcut?name=${encodeURIComponent(name)}${text === undefined ? '' : `&input=text&text=${encodeURIComponent(text)}`}`;

/** Legge i dati che il Comando «Salute Ferro» passa a Ferro (?salute=…): pesate e massa grassa per giorno. */
export function parseAppleImport(text: string): { date: string; weightKg?: number; bodyFat?: number }[] {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }
  const byDate = new Map<string, { date: string; weightKg?: number; bodyFat?: number }>();
  const read = (kind: 'peso' | 'grasso', field: 'weightKg' | 'bodyFat', min: number, max: number) => {
    const list = Array.isArray(data[kind]) ? (data[kind] as unknown[]) : [];
    for (const raw of list) {
      const item = raw as { v?: unknown; d?: unknown };
      const v = typeof item.v === 'number' ? item.v : Number(String(item.v ?? '').replace(',', '.'));
      const date = String(item.d ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(v) || v < min || v > max) continue;
      const row = byDate.get(date) ?? { date };
      row[field] = round1(v); // l'ultimo valore del giorno vince
      byDate.set(date, row);
    }
  };
  read('peso', 'weightKg', 25, 350);
  read('grasso', 'bodyFat', 2, 75);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Link iCloud dei due Comandi rapidi, da compilare quando sono stati creati e condivisi
 * (app Comandi → Condividi → Copia link iCloud). Finché sono vuoti l'app rimanda alla guida.
 */
export const SHORTCUT_LINKS = { toHealth: '', fromHealth: '' };
export const SHORTCUT_GUIDE = '/#salute';
