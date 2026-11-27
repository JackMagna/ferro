/**
 * Attività registrate dall'orologio (o da un'altra app) e lette da Health Connect, trasformate in sedute di Ferro.
 * - Si saltano quelle scritte da Ferro stesso, quelle già importate e quelle che si sovrappongono a una seduta
 *   già in Ferro (chi registra la palestra anche con l'orologio non deve trovarla due volte).
 * - Diventano sedute fuori dalla scheda (dayId «orologio»): non spostano la rotazione dei giorni.
 * - Sono già in Health Connect: healthSynced = true, così non si rimandano indietro.
 */
import type { Workout } from '@capgo/capacitor-health';
import type { WorkoutSession } from '../types';
import { isOffProgramSession, WATCH_DAY_ID } from './lessons';
import { t } from './i18n';

export type WatchWorkout = Pick<Workout, 'workoutType' | 'duration' | 'startDate' | 'endDate' | 'totalDistance' | 'totalEnergyBurned' | 'sourceId' | 'sourceName' | 'platformId'>;

const LABELS: Record<string, string> = {
  running: t('Corsa'), runningTreadmill: t('Tapis roulant'), walking: t('Camminata'), hiking: t('Escursione'),
  cycling: t('Bici'), bikingStationary: t('Cyclette'), handCycling: 'Handbike',
  swimming: t('Nuoto'), swimmingPool: t('Nuoto in piscina'), swimmingOpenWater: t('Nuoto in acque libere'),
  rowing: t('Canottaggio'), rowingMachine: t('Vogatore'), elliptical: t('Ellittica'),
  stairClimbing: t('Scale'), stairClimbingMachine: 'Stair climber',
  strengthTraining: t('Forza'), traditionalStrengthTraining: t('Forza'), functionalStrengthTraining: t('Forza funzionale'), weightlifting: t('Pesi'), calisthenics: t('Corpo libero'),
  highIntensityIntervalTraining: 'HIIT', crossTraining: 'Cross training', bootCamp: 'Bootcamp', mixedCardio: 'Cardio',
  pilates: 'Pilates', yoga: 'Yoga', stretching: 'Stretching', flexibility: t('Mobilità'), exerciseClass: t('Lezione'),
  dance: t('Danza'), dancing: t('Danza'), boxing: t('Boxe'), kickboxing: 'Kickboxing', martialArts: t('Arti marziali'),
  soccer: t('Calcio'), basketball: t('Basket'), volleyball: t('Pallavolo'), tennis: 'Tennis', padel: 'Padel', paddleSports: t('Pagaia'),
  rockClimbing: t('Arrampicata'), climbing: t('Arrampicata'), skiing: t('Sci'), snowboarding: 'Snowboard', other: t('Allenamento')
};

/** Nome italiano del tipo di attività di Health Connect. */
export function watchLabel(type: string): string {
  return LABELS[type] ?? t('Allenamento');
}

/** Pacchetti di Ferro (app vera e app di prova): le loro attività sono già in Ferro. */
const isFerro = (w: WatchWorkout) => !!w.sourceId && /^it\.irontrack\.app(\.|$)/.test(w.sourceId);

const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Sovrapposizione di almeno metà della più corta delle due. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const common = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
  const shorter = Math.min(aEnd - aStart, bEnd - bStart);
  return common > 0 && common >= shorter / 2;
}

export function watchSessionId(w: WatchWorkout): string {
  const key = w.platformId || `${w.sourceId ?? ''}-${Date.parse(w.startDate)}`;
  return `hc-${key.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)}`;
}

/** Le attività nuove, già pronte come sedute (dalla più recente). */
export function watchSessions(workouts: WatchWorkout[], sessions: WorkoutSession[]): WorkoutSession[] {
  const known = new Set(sessions.map((s) => s.id));
  const week = sessions.find((s) => !isOffProgramSession(s))?.weekNumber ?? 1;
  const out: WorkoutSession[] = [];
  for (const w of workouts) {
    const start = Date.parse(w.startDate);
    const end = Date.parse(w.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || isFerro(w)) continue;
    const id = watchSessionId(w);
    if (known.has(id) || out.some((s) => s.id === id)) continue;
    if (sessions.some((s) => s.startedAt && s.endedAt && overlaps(start, end, s.startedAt, s.endedAt))) continue;
    const label = watchLabel(w.workoutType);
    const seconds = Math.round(w.duration > 0 ? w.duration : (end - start) / 1000);
    const distance = w.totalDistance && w.totalDistance >= 10 ? Math.round(w.totalDistance) : undefined;
    out.push({
      id,
      date: localDate(start),
      startedAt: start,
      endedAt: end,
      dayId: WATCH_DAY_ID,
      dayTitle: label,
      weekNumber: week,
      durationMinutes: Math.max(1, Math.round(seconds / 60)),
      totalVolumeKg: 0,
      sets: [{ exerciseId: WATCH_DAY_ID, exerciseName: label, setIndex: 0, weightKg: 0, reps: 0, durationSec: seconds, ...(distance ? { distanceM: distance } : {}) }],
      healthSynced: true,
      healthLogId: 'hc',
      hcSynced: true
    });
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}
