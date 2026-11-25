import { readJSON, removeKey, writeJSON } from './storage';

/**
 * Consenso esplicito al trattamento dei dati sulla salute (art. 9.2.a GDPR).
 * Dati sanitari in Ferro: misure, frequenza cardiaca, pasti, dieta, referti e dati da Google Health,
 * Health Connect e Apple Salute. Scheda e allenamenti non lo richiedono.
 * Senza account si salva sul dispositivo; con l'account in users/{uid}.consent.health.
 */
export const CONSENT_VERSION = 1;
export const CONSENT_KEY = 'irontrack:consent';
/** L'avviso per chi ha già dati sanitari salvati si mostra una volta sola. */
export const CONSENT_ASKED_KEY = 'irontrack:consent-asked';

export interface HealthConsent { version: number; at: string }

/** Legge un consenso salvato; qualsiasi valore non valido vale come nessun consenso. */
export function normalizeConsent(raw: unknown): HealthConsent | null {
  const c = raw as Partial<HealthConsent> | null;
  if (!c || typeof c !== 'object') return null;
  if (typeof c.version !== 'number' || !Number.isInteger(c.version) || c.version < 1) return null;
  if (typeof c.at !== 'string' || Number.isNaN(Date.parse(c.at))) return null;
  return { version: c.version, at: c.at };
}

/** Valido solo se è stato dato per la versione attuale del testo. */
export const hasValidConsent = (c: HealthConsent | null | undefined): boolean => c?.version === CONSENT_VERSION;

export const newConsent = (now = new Date()): HealthConsent => ({ version: CONSENT_VERSION, at: now.toISOString() });

export const readLocalConsent = () => normalizeConsent(readJSON<unknown>(CONSENT_KEY, null));
export const writeLocalConsent = (c: HealthConsent) => writeJSON(CONSENT_KEY, c);
export const clearLocalConsent = () => removeKey(CONSENT_KEY);

/** Data del consenso in italiano, es. «28/10/2026». */
export const consentDate = (c: HealthConsent) => new Date(c.at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
