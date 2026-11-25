/**
 * Giorno bonus: raccoglie gli esercizi saltati nei giorni precedenti della settimana (lunedì–domenica).
 *
 * Conta come saltato:
 * - un esercizio di un giorno della scheda già allenato in settimana, con meno serie di quelle previste
 *   (nel bonus restano solo le serie mancanti);
 * - un esercizio di un giorno mai allenato in settimana, se è un giorno "precedente": in settimana è già stato
 *   fatto un giorno che nella scheda viene dopo (es. fatti A e C → B è saltato).
 *
 * Gli esercizi del bonus hanno lo stesso id di quelli della scheda: le serie contano per i giorni originali
 * (record, ultimo carico, foglio del coach) e, una volta fatte, spariscono dal bonus.
 */
import type { ProgramDay, SetEntry, WorkoutProgram, WorkoutSession } from '../types';
import { plannedSetCount } from './activity';
import { todayISO } from './ids';
import { isOffProgramSession } from './lessons';

export const BONUS_DAY_ID = 'bonus';
export const isBonusSession = (s: Pick<WorkoutSession, 'dayId'>) => s.dayId === BONUS_DAY_ID;

export interface BonusDay {
  day: ProgramDay;
  /** settimana del programma da cui prendere le prescrizioni */
  week: number;
  /** serie già fatte in settimana per esercizio: il bonus parte da lì */
  doneBefore: Record<string, number>;
}

/** Lunedì (AAAA-MM-GG) della settimana che contiene la data. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // lunedì = 0
  d.setDate(d.getDate() - dow);
  return todayISO(d);
}

/** Sessioni della stessa settimana di calendario (lunedì–domenica) della data, fino a quel giorno compreso. */
export function sessionsOfWeek(sessions: WorkoutSession[], dateISO: string): WorkoutSession[] {
  const from = mondayOf(dateISO);
  return sessions.filter((s) => s.date >= from && s.date <= dateISO);
}

export function computeBonusDay(program: WorkoutProgram, sessions: WorkoutSession[], today = todayISO()): BonusDay | null {
  // le lezioni fatte (pilates, spinning…) non contano per la scheda
  const week = sessionsOfWeek(sessions, today).filter((s) => !isOffProgramSession(s));
  if (!week.length || !program.days.length) return null;

  const latest = [...week].sort((a, b) => b.startedAt - a.startedAt)[0];
  const programWeek = Math.min(Math.max(1, latest.weekNumber), program.totalWeeks);

  const doneSets = new Map<string, number>();
  week.forEach((s) => s.sets.forEach((set) => doneSets.set(set.exerciseId, (doneSets.get(set.exerciseId) ?? 0) + 1)));
  const trainedDays = new Set(week.filter((s) => !isBonusSession(s)).map((s) => s.dayId));
  const lastTrainedIdx = Math.max(-1, ...program.days.map((d, i) => (trainedDays.has(d.id) ? i : -1)));

  const doneBefore: Record<string, number> = {};
  const exercises = program.days.flatMap((d, i) => {
    const trained = trainedDays.has(d.id);
    // un giorno mai allenato è saltato solo se in settimana è già stato fatto un giorno successivo
    if (!trained && i > lastTrainedIdx) return [];
    return d.exercises.filter((ex) => {
      const planned = plannedSetCount(ex, programWeek);
      const done = doneSets.get(ex.id) ?? 0;
      // un giorno mai allenato ma con qualche esercizio fatto in un bonus: valgono le serie già fatte
      if (planned === 0 || done >= planned) return false;
      doneBefore[ex.id] = done;
      return true;
    });
  });
  if (!exercises.length) return null;

  const count = exercises.length;
  return {
    day: {
      id: BONUS_DAY_ID,
      title: 'Bonus',
      subtitle: `Recupero della settimana: ${count} ${count === 1 ? 'esercizio saltato' : 'esercizi saltati'}`,
      exercises
    },
    week: programWeek,
    doneBefore
  };
}

/**
 * Serie da scrivere nel foglio del coach per un esercizio di un bonus: quelle fatte prima in settimana
 * (stessa settimana del programma) più quelle del bonus, così la cella non perde le serie già scritte.
 */
export function setsWithEarlier(session: WorkoutSession, exerciseId: string, history: WorkoutSession[]): SetEntry[] {
  const own = session.sets.filter((s) => s.exerciseId === exerciseId);
  if (!isBonusSession(session)) return own;
  const from = mondayOf(session.date);
  const earlier = history
    .filter((h) => h.id !== session.id && h.weekNumber === session.weekNumber && h.date >= from && h.date <= session.date && h.startedAt < session.startedAt)
    .flatMap((h) => h.sets.filter((s) => s.exerciseId === exerciseId));
  return [...earlier, ...own];
}
