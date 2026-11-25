import { normalize } from './exerciseLibrary';
import { readJSON, writeJSON } from './storage';

/**
 * Passo del carico scelto per ogni esercizio (manubri da 1 o 2 kg, bilanciere da 2,5, macchine da 5…).
 * Resta su questo dispositivo, chiave = nome dell'esercizio normalizzato.
 */
const KEY = 'irontrack:weight-steps';
export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5] as const;
export const DEFAULT_WEIGHT_STEP = 2.5;

export function getWeightStep(exerciseName: string): number {
  const v = readJSON<Record<string, number>>(KEY, {})[normalize(exerciseName)];
  return (WEIGHT_STEPS as readonly number[]).includes(v) ? v : DEFAULT_WEIGHT_STEP;
}

export function setWeightStep(exerciseName: string, step: number) {
  const all = readJSON<Record<string, number>>(KEY, {});
  if (step === DEFAULT_WEIGHT_STEP) delete all[normalize(exerciseName)];
  else all[normalize(exerciseName)] = step;
  writeJSON(KEY, all);
}

/** Pulsanti del carico per un passo: ±passo grande e, sotto, ±doppio e ±quadruplo (2,5 → 2,5 / 5 / 10). */
export const stepButtons = (step: number) => [step, step * 2, step * 4];

/** Testo con la virgola e senza zeri inutili: 22,5 · 1,25 · 80. */
export const decimalText = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

/**
 * Numero scritto a mano: accetta virgola o punto, spazi e unità ("80 kg", "22,5").
 * Restituisce undefined se non è un numero.
 */
export function parseTyped(text: string): number | undefined {
  const clean = text.trim().replace(/\s+/g, '').replace(/(kg|rip|x)$/i, '').replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}
