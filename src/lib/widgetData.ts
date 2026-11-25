import type { DietPlan, FoodEntry, WorkoutProgram, WorkoutSession } from '../types';
import { suggestNext, type WorkoutDraft } from '../components/workout/draft';
import { entriesFor, planDayFor, targetsFor, totalsOf } from './nutrition';
import { todayISO } from './ids';
import { BONUS_DAY_ID, computeBonusDay } from './bonusDay';

/**
 * Dati per i widget della schermata Home (solo app Android).
 * Il formato è letto dal codice nativo in native/android (WidgetData.java): se cambia, cambiare entrambi.
 */
export interface WidgetPalette { bg: string; fg: string; muted: string; accent: string; accentText: string; accentInk: string; track: string }

export interface WidgetData {
  v: 1;
  updatedAt: number;
  palette: WidgetPalette;
  workout: {
    day: string;
    week: number;
    totalWeeks: number;
    program: string;
    inProgress: boolean;
    exercises: { name: string; sets: string }[];
  } | null;
  /** inizio dell'ultimo allenamento (ms), per «fermo da N giorni» */
  lastWorkoutAt: number | null;
  /** il widget dei pasti mostra solo con il consenso ai dati sanitari */
  meals: {
    date: string;
    kcal: number; proteinG: number; carbsG: number; fatG: number;
    target: { kcal?: number; proteinG?: number; carbsG?: number; fatG?: number };
  } | null;
  mealsLocked: boolean;
}

export const DEFAULT_PALETTE: WidgetPalette = { bg: '#222529', fg: '#eeebe4', muted: '#a8a69e', accent: '#f0c33c', accentText: '#f0c33c', accentInk: '#2a2104', track: '#2c3035' };

const sets = (raw: string | undefined) => (raw ?? '').trim().toUpperCase().replace(/\s*[X×]\s*/g, '×');

export function buildWidgetData(args: {
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  meals: FoodEntry[];
  dietPlan: DietPlan | null;
  consented: boolean;
  draft: WorkoutDraft | null;
  palette?: WidgetPalette;
  now?: Date;
}): WidgetData {
  const now = args.now ?? new Date();
  const { program, sessions } = args;
  const inProgress = !!args.draft && Object.values(args.draft.sets).some((l) => l.some((s) => s.completed));
  const next = inProgress ? { dayId: args.draft!.dayId, week: args.draft!.week } : suggestNext(program, sessions);
  const bonus = next.dayId === BONUS_DAY_ID ? computeBonusDay(program, sessions, todayISO(now))?.day : undefined;
  const day = bonus ?? program.days.find((d) => d.id === next.dayId) ?? program.days[0];
  const week = Math.min(Math.max(1, next.week), program.totalWeeks);
  const last = sessions.reduce<number | null>((m, s) => Math.max(m ?? 0, s.startedAt || Date.parse(`${s.date}T12:00:00`)), null);

  const date = todayISO(now);
  let meals: WidgetData['meals'] = null;
  if (args.consented) {
    const t = totalsOf(entriesFor(args.meals, date));
    const target = targetsFor(args.dietPlan, planDayFor(args.dietPlan, date));
    meals = { date, kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, target };
  }

  return {
    v: 1,
    updatedAt: now.getTime(),
    palette: args.palette ?? DEFAULT_PALETTE,
    workout: day
      ? {
          day: day.title,
          week,
          totalWeeks: program.totalWeeks,
          program: program.title,
          inProgress,
          exercises: day.exercises.map((e) => ({ name: e.name, sets: sets(e.weeks[week]) }))
        }
      : null,
    lastWorkoutAt: last,
    meals,
    mealsLocked: !args.consented
  };
}

/** Colori del tema attuale, letti dalle variabili CSS (solo esadecimali: il codice nativo non capisce altro). */
export function readPalette(el: Element = document.documentElement): WidgetPalette {
  const css = getComputedStyle(el);
  const pick = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  };
  return {
    bg: pick('--color-panel', DEFAULT_PALETTE.bg),
    fg: pick('--color-chalk', DEFAULT_PALETTE.fg),
    muted: pick('--color-muted', DEFAULT_PALETTE.muted),
    accent: pick('--color-plate', DEFAULT_PALETTE.accent),
    accentText: pick('--color-plate-text', DEFAULT_PALETTE.accentText),
    accentInk: pick('--color-plate-ink', DEFAULT_PALETTE.accentInk),
    track: pick('--color-raised', DEFAULT_PALETTE.track)
  };
}
