/**
 * Che tipo di allenamento è una seduta, per Health Connect (e per le note di Google Health).
 * - Seduta della scheda con pesi (anche se c'è un po' di cardio): forza.
 * - Seduta fatta solo di una disciplina (cyclette, corsa, nuoto…): quella disciplina.
 * - Blocchi senza pesi (AMRAP, EMOM, Tabata): HIIT.
 * - Lezione segnata come fatta: dal titolo («Pilates reformer» → pilates, «Spinning» → bici da interno).
 * I nomi sono quelli che FerroWorkoutPlugin.java traduce nelle costanti EXERCISE_TYPE_* di Health Connect.
 */
import type { WorkoutSession } from '../types';
import { activityOf, formatDistance, formatDuration, isCardio } from './activity';
import { isLessonSession, lessonActivity } from './lessons';
import { formatKg } from './ids';

export type WorkoutKind =
  | 'strength' | 'biking' | 'biking_stationary' | 'running' | 'running_treadmill' | 'swimming_pool' | 'rowing_machine'
  | 'elliptical' | 'walking' | 'pilates' | 'yoga' | 'stretching' | 'hiit' | 'exercise_class';

const INDOOR_BIKE = /cyclette|spinning|spin|rulli|indoor|assault|air bike|echo bike|bike erg/i;
const TREADMILL = /tapis|treadmill/i;
const HIIT = /hiit|tabata|wod|crossfit|hyrox|circuit|amrap|emom|functional|funzionale|bootcamp|boot camp/i;

function kindOfName(name: string, lesson: boolean): WorkoutKind | null {
  const a = lesson ? lessonActivity(name) : activityOf(name);
  switch (a) {
    case 'bici': return lesson || INDOOR_BIKE.test(name) ? 'biking_stationary' : 'biking';
    case 'corsa': return TREADMILL.test(name) ? 'running_treadmill' : 'running';
    case 'nuoto': return 'swimming_pool';
    case 'vogatore': return 'rowing_machine';
    case 'ellittica': return 'elliptical';
    case 'camminata': return 'walking';
    case 'pilates': return 'pilates';
    case 'mobilita': return /yoga/i.test(name) ? 'yoga' : 'stretching';
    case 'forza': return lesson ? (HIIT.test(name) ? 'hiit' : 'strength') : null;
    default: return lesson ? (HIIT.test(name) ? 'hiit' : 'exercise_class') : null;
  }
}

export function workoutKind(s: WorkoutSession): WorkoutKind {
  if (isLessonSession(s)) return kindOfName(s.dayTitle, true) ?? 'exercise_class';
  // pesi o ripetizioni a corpo libero di un esercizio che non è cardio
  const loaded = s.sets.some((x) => x.weightKg > 0 || (x.reps > 0 && !x.durationSec && !x.distanceM && !isCardio(activityOf(x.exerciseName))));
  if (loaded) return 'strength';
  const kinds = new Set(s.sets.map((x) => kindOfName(x.exerciseName, false)));
  if (kinds.size === 1) {
    const [only] = [...kinds];
    if (only) return only;
  }
  if (s.blockResults?.length) return 'hiit';
  return 'strength';
}

/** Riassunto per le note dell'allenamento: serie e volume per la forza, tempo e distanza per il resto. */
export function workoutNotes(s: WorkoutSession): string {
  if (isLessonSession(s)) return `Ferro: lezione, ${s.durationMinutes} min`;
  const parts: string[] = [];
  const loadSets = s.sets.filter((x) => x.weightKg > 0 || (x.reps > 0 && !x.distanceM && !x.durationSec));
  if (loadSets.length) parts.push(`${loadSets.length} serie`);
  if (s.totalVolumeKg > 0) parts.push(`${formatKg(s.totalVolumeKg)} kg di volume`);
  const sec = s.sets.reduce((t, x) => t + (x.durationSec && !x.weightKg ? x.durationSec : 0), 0);
  const m = s.sets.reduce((t, x) => t + (x.distanceM ?? 0), 0);
  if (m > 0) parts.push(formatDistance(m));
  if (sec > 0 && !loadSets.length) parts.push(formatDuration(sec));
  if (s.blockResults?.length) parts.push(`${s.blockResults.length} ${s.blockResults.length === 1 ? 'blocco' : 'blocchi'}`);
  return `Ferro: ${parts.join(', ') || `${s.durationMinutes} min`}`;
}
