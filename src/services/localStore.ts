import type { DietPlan, FoodEntry, Measurement, SavedMeal, WaterLog, WorkoutProgram, WorkoutSession } from '../types';
import { readJSON, removeKey, writeJSON } from '../lib/storage';
import { normalizeDietPlan, normalizeMeal, normalizeMeasurement, normalizeProgram, normalizeSavedMeals, normalizeSession, normalizeWater } from './normalize';

/** Dati salvati sul dispositivo quando usi l'app senza account. */
export interface LocalData {
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  measurements: Measurement[];
  meals: FoodEntry[];
  dietPlan: DietPlan | null;
  spreadsheetId: string;
  savedMeals: SavedMeal[];
  water: WaterLog;
}

const KEY = 'irontrack:local-data';
const LEGACY = {
  sessions: 'irontrack_sessions',
  measurements: 'irontrack_measurements',
  sheet: 'irontrack_sheet_id',
  initialized: 'irontrack_initialized'
};

export function loadLocalData(): LocalData {
  const stored = readJSON<Partial<LocalData> | null>(KEY, null);
  if (stored) {
    return {
      program: normalizeProgram(stored.program),
      sessions: (stored.sessions ?? []).map((s) => normalizeSession(s as never)),
      measurements: (stored.measurements ?? []).map((m) => normalizeMeasurement(m as never)),
      meals: (stored.meals ?? []).map((m) => normalizeMeal(m as never)),
      dietPlan: normalizeDietPlan(stored.dietPlan),
      spreadsheetId: stored.spreadsheetId ?? '',
      savedMeals: normalizeSavedMeals(stored.savedMeals),
      water: normalizeWater(stored.water)
    };
  }
  // Prima apertura dopo l'aggiornamento: recupera i dati della versione precedente.
  const data: LocalData = {
    program: normalizeProgram(null),
    sessions: readJSON<Record<string, unknown>[]>(LEGACY.sessions, []).map((s) => normalizeSession(s)),
    measurements: readJSON<Record<string, unknown>[]>(LEGACY.measurements, []).map((m) => normalizeMeasurement(m)),
    meals: [],
    dietPlan: null,
    spreadsheetId: rawLegacySheet(),
    savedMeals: [],
    water: {}
  };
  saveLocalData(data);
  Object.values(LEGACY).forEach(removeKey);
  return data;
}

function rawLegacySheet(): string {
  try {
    const v = localStorage.getItem(LEGACY.sheet) ?? '';
    return v.replace(/^"|"$/g, '');
  } catch {
    return '';
  }
}

export function saveLocalData(data: LocalData) {
  writeJSON(KEY, data);
}

export function hasLocalActivity(data: LocalData): boolean {
  return data.sessions.length > 0 || data.measurements.length > 0 || data.meals.length > 0 || !!data.dietPlan || !!data.program.updatedAt
    || data.savedMeals.length > 0 || Object.keys(data.water).length > 0;
}

export function clearLocalData() {
  removeKey(KEY);
}
