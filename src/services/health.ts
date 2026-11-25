import { readJSON, writeJSON } from '../lib/storage';

/** Da dove arrivano (e dove vanno) peso, massa grassa e frequenza cardiaca. Una sola fonte per volta. */
export type HealthSource = 'none' | 'googlehealth' | 'healthconnect';

const SOURCE_KEY = 'irontrack:health-source';
const GH_KEY = 'irontrack:gh-connected';
const PREFS_KEY = 'irontrack:health-prefs';
const listeners = new Set<() => void>();

export const subscribeHealth = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
export const notifyHealth = () => listeners.forEach((l) => l());

export function getHealthSource(): HealthSource {
  const v = readJSON<string>(SOURCE_KEY, 'none');
  // "fitbit" era la scelta della versione precedente: le vecchie API Fitbit vengono spente il 30 ottobre 2026: Google Health ne prende il posto
  if (v === 'fitbit') return 'googlehealth';
  return v === 'googlehealth' || v === 'healthconnect' ? v : 'none';
}
export function setHealthSource(source: HealthSource) {
  writeJSON(SOURCE_KEY, source);
  notifyHealth();
}
export const SOURCE_LABEL: Record<HealthSource, string> = { none: 'Nessuna', googlehealth: 'Google Health', healthconnect: 'Health Connect' };

/** Il collegamento a Google Health è stato fatto (permessi concessi e profilo verificato). */
export const isGoogleHealthConnected = () => readJSON<boolean>(GH_KEY, false);
export function setGoogleHealthConnected(v: boolean) {
  writeJSON(GH_KEY, v);
  notifyHealth();
}

/** autoMeals: invia i pasti a Google Health. È spento di default perché richiede un permesso in più. */
export interface HealthPrefs { autoLog: boolean; autoMeals: boolean }
export const getHealthPrefs = (): HealthPrefs => ({ autoLog: true, autoMeals: false, ...readJSON<Partial<HealthPrefs>>(PREFS_KEY, {}) });
export function setHealthPrefs(p: Partial<HealthPrefs>) {
  writeJSON(PREFS_KEY, { ...getHealthPrefs(), ...p });
  notifyHealth();
}
