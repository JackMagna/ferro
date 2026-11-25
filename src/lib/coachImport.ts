import type { WorkoutProgram } from '../types';
import type { LibraryExercise } from './exerciseLibrary';
import { mergeWithPrevious } from './coachSheet';
import { suggestLibraryId } from './exerciseMatch';
import { programFingerprint } from './programDiff';

/**
 * Prepara la scheda letta dal foglio per sostituire quella attuale: mantiene id, collegamenti alla libreria,
 * data di inizio e impostazioni, e salva l'impronta per accorgersi delle prossime modifiche del coach.
 */
export function prepareImported(
  parsed: WorkoutProgram,
  current: WorkoutProgram,
  library: LibraryExercise[],
  opts: { measuresTab?: string; annotate?: boolean } = {}
): WorkoutProgram {
  const merged = mergeWithPrevious(parsed, current);
  return {
    ...merged,
    startDate: current.startDate,
    source: merged.source && {
      ...merged.source,
      measuresTab: opts.measuresTab,
      annotate: opts.annotate ?? merged.source.annotate,
      fingerprint: programFingerprint(parsed)
    },
    days: merged.days.map((d) => ({
      ...d,
      // un collegamento tolto a mano (linkedBy 'utente' senza libraryId) resta tolto
      exercises: d.exercises.map((e) => ({ ...e, libraryId: e.libraryId ?? (e.linkedBy === 'utente' ? undefined : suggestLibraryId(e.name, library)) }))
    }))
  };
}
