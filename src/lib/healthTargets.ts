import type { Measurement, WorkoutSession } from '../types';
import type { BodyEntry } from './healthMath';

/**
 * Cosa è già arrivato a Health Connect e cosa no.
 * Google Health e Health Connect hanno segni separati: `healthSynced` vale per Google Health (com'era all'inizio),
 * `hcSynced` per Health Connect. Prima della v2.5.2 un solo segno valeva per tutte e due, quindi un allenamento
 * registrato su Google Health dal sito non veniva mai mandato a Health Connect.
 */

/** L'allenamento è già in Health Connect (inviato da Ferro, o letto dall'orologio: healthLogId 'hc'). */
export const sessionInHealthConnect = (s: WorkoutSession) => s.hcSynced === true || s.healthLogId === 'hc';

/** L'allenamento è già su Google Health (quelli con 'hc' sono stati segnati dalle versioni vecchie per Health Connect). */
export const sessionOnGoogleHealth = (s: WorkoutSession) => s.healthSynced === true && s.healthLogId !== 'hc';

/** Allenamenti da mandare a Health Connect, dal più vecchio, saltando quelli senza durata valida. */
export function sessionsForHealthConnect(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => !sessionInHealthConnect(s) && Number.isFinite(s.startedAt) && s.startedAt > 0)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Pesate da mandare a Health Connect: hanno peso o massa grassa e non arrivano già da Health Connect. */
export function measurementsForHealthConnect(measurements: Measurement[]): Measurement[] {
  return measurements
    .filter((m) => m.hcSynced !== true && m.source !== 'Health Connect' && (m.weightKg !== undefined || m.bodyFat !== undefined))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * La pesata c'è già in Health Connect (stesso giorno, peso entro 0,1 kg o massa grassa entro 0,1 punti)?
 * Serve a non creare doppioni con le pesate inviate dalle versioni vecchie, che non lasciavano un segno.
 */
export function bodyAlreadyThere(m: Measurement, existing: BodyEntry[]): boolean {
  return existing.some(
    (e) =>
      e.date === m.date &&
      (m.weightKg === undefined || (e.weightKg !== undefined && Math.abs(e.weightKg - m.weightKg) < 0.1)) &&
      (m.bodyFat === undefined || (e.bodyFat !== undefined && Math.abs(e.bodyFat - m.bodyFat) < 0.1))
  );
}
