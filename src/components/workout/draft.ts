import type { BlockResult, ProgramDay, SetLog, WorkoutProgram, WorkoutSession } from '../../types';
import { parsePrescription } from '../../lib/prescription';
import { planFor, plannedTotals } from '../../lib/activity';
export { plannedSetCount } from '../../lib/activity';
import { lastSetsFor } from '../../lib/stats';
import { readJSON, removeKey, writeJSON } from '../../lib/storage';
import { isBonusSession } from '../../lib/bonusDay';
import { isOffProgramSession } from '../../lib/lessons';

export interface WorkoutDraft {
  dayId: string;
  week: number;
  /** momento della prima serie completata */
  startedAt: number | null;
  sets: Record<string, SetLog[]>;
  exIndex: number;
  setIndex: number;
  hr: { sum: number; count: number; max: number };
  /** risultati dei blocchi (AMRAP, For Time…) scritti durante l'allenamento */
  blockResults?: Record<string, BlockResult>;
}

const KEY = 'irontrack:workout-draft';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Una bozza rovinata o di una versione vecchia non deve mai far partire l'app in crash. */
export function isValidDraft(d: unknown): d is WorkoutDraft {
  const x = d as Partial<WorkoutDraft> | null;
  if (!x || typeof x !== 'object' || typeof x.dayId !== 'string' || !isNum(x.week) || !isNum(x.exIndex) || !isNum(x.setIndex)) return false;
  if (x.startedAt !== null && !isNum(x.startedAt)) return false;
  if (!x.hr || !isNum(x.hr.sum) || !isNum(x.hr.count) || !isNum(x.hr.max)) return false;
  if (!x.sets || typeof x.sets !== 'object') return false;
  return Object.values(x.sets).every(
    (list) => Array.isArray(list) && list.every((s) => s && isNum(s.weightKg) && isNum(s.reps) && typeof s.completed === 'boolean')
  ) && (x.blockResults === undefined || (typeof x.blockResults === 'object' && x.blockResults !== null));
}


export function loadDraft(): WorkoutDraft | null {
  const d = readJSON<unknown>(KEY, null);
  if (isValidDraft(d)) return d;
  if (d !== null) removeKey(KEY);
  return null;
}
export function saveDraft(d: WorkoutDraft) {
  writeJSON(KEY, d);
}
export function clearDraft() {
  removeKey(KEY);
}

export function draftHasProgress(d: WorkoutDraft | null): boolean {
  return !!d && Object.values(d.sets).some((list) => list.some((s) => s.completed));
}

/**
 * Serie iniziali: prescrizione della settimana + pesi usati l'ultima volta.
 * doneBefore (giorno bonus): serie già fatte in settimana per esercizio; si preparano solo quelle mancanti.
 */
export function buildDraft(day: ProgramDay, week: number, sessions: WorkoutSession[], doneBefore: Record<string, number> = {}): WorkoutDraft {
  const sets: Record<string, SetLog[]> = {};
  for (const ex of day.exercises) {
    const plan = planFor(ex, week);
    const last = lastSetsFor(sessions, ex.id, ex.name);
    if (plan.kind === 'tenuta') {
      const skip = Math.min(doneBefore[ex.id] ?? 0, plan.sets);
      sets[ex.id] = Array.from({ length: plan.sets - skip }, (_, j) => ({ weightKg: last[skip + j]?.weightKg ?? 0, reps: 0, durationSec: plan.timeSec, completed: false }));
      continue;
    }
    if (plan.kind !== 'carico') {
      // cardio, nuoto, blocchi, testo: una voce sola, con durata e distanza previste già scritte
      const totals = plannedTotals(plan);
      sets[ex.id] = (doneBefore[ex.id] ?? 0) > 0 ? [] : [{ weightKg: 0, reps: plan.kind === 'intervalli' ? plan.reps : 0, completed: false, ...totals }];
      continue;
    }
    const p = parsePrescription(ex.weeks[week]);
    const fallbackWeight = ex.sectionType === 'core' ? 0 : 20;
    const skip = Math.min(doneBefore[ex.id] ?? 0, p.reps.length);
    sets[ex.id] = p.reps.slice(skip).map((reps, j) => {
      const i = skip + j;
      return { weightKg: last[i]?.weightKg ?? last[last.length - 1]?.weightKg ?? fallbackWeight, reps, completed: false };
    });
  }
  return { dayId: day.id, week, startedAt: null, sets, exIndex: 0, setIndex: 0, hr: { sum: 0, count: 0, max: 0 } };
}

/** Allenamento suggerito: il giorno dopo l'ultimo fatto, nella stessa settimana del programma. Il giorno bonus non sposta la sequenza. */
export function suggestNext(program: WorkoutProgram, sessions: WorkoutSession[]): { dayId: string; week: number } {
  const last = sessions.filter((s) => !isBonusSession(s) && !isOffProgramSession(s)).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!last) return { dayId: program.days[0]?.id ?? '', week: 1 };
  const idx = program.days.findIndex((d) => d.id === last.dayId);
  if (idx === -1) return { dayId: program.days[0]?.id ?? '', week: Math.min(last.weekNumber, program.totalWeeks) };
  const nextIdx = (idx + 1) % program.days.length;
  const week = nextIdx === 0 ? Math.min(program.totalWeeks, last.weekNumber + 1) : last.weekNumber;
  return { dayId: program.days[nextIdx].id, week: Math.max(1, week) };
}
