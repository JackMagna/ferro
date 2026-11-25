import type { ProgramExercise, SetLog } from '../types';
import { formatLoad } from './ids';
import { t } from './i18n';

/** Quello che la notifica dell'allenamento mostra (formato letto da WorkoutNotice.java). */
export interface WorkoutNoticeState {
  /** esercizio e serie da fare: "Panca piana · serie 3 di 4" */
  title: string;
  /** fuori dal recupero: carico e ripetizioni della serie da fare */
  text: string;
  /** durante il recupero, accanto al conto alla rovescia: la serie che viene dopo */
  restText: string;
  /** riga piccola: giorno e serie fatte */
  sub: string;
  /** fine del recupero (ms); 0 se non si sta recuperando */
  endAt: number;
  done: number;
  total: number;
  /** avviso di fine recupero */
  endTitle: string;
  endText: string;
  /** false: niente suono né vibrazione (disattivati nelle impostazioni) */
  alert: boolean;
}

interface Input {
  dayTitle: string;
  exercise: ProgramExercise;
  sets: SetLog[];
  setIndex: number;
  prescription?: string;
  done: number;
  total: number;
  restEndAt?: number;
  alert: boolean;
}

const load = (s: SetLog | undefined) => (s ? `${formatLoad(s.weightKg)} kg × ${s.reps}` : '');

export function workoutNoticeState({ dayTitle, exercise, sets, setIndex, prescription, done, total, restEndAt, alert }: Input): WorkoutNoticeState {
  const current = sets[setIndex];
  const allDone = sets.length > 0 && sets.every((s) => s.completed);
  const title = allDone ? t('{name} · fatto', { name: exercise.name }) : t('{name} · serie {n} di {total}', { name: exercise.name, n: setIndex + 1, total: sets.length });
  const next = allDone ? t('Passa al prossimo esercizio') : load(current);
  return {
    title,
    text: [next, prescription].filter(Boolean).join(' · '),
    restText: next ? t('Recupero · poi {next}', { next }) : t('Recupero'),
    sub: t('{day} · {done} di {total} serie', { day: dayTitle, done, total }),
    endAt: restEndAt && restEndAt > Date.now() ? restEndAt : 0,
    done,
    total,
    endTitle: t('Recupero finito'),
    endText: allDone ? t('{name} completato: passa al prossimo esercizio', { name: exercise.name }) : t('{name}, serie {n}: {next}', { name: exercise.name, n: setIndex + 1, next }),
    alert
  };
}
