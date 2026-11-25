import { describe, expect, it } from 'vitest';
import type { ProgramDay, ProgramExercise, WorkoutProgram, WorkoutSession } from '../../types';
import { BONUS_DAY_ID, computeBonusDay, mondayOf } from '../bonusDay';
import { planAnnotations } from '../sheetWrite';
import { buildDraft, suggestNext } from '../../components/workout/draft';

const ex = (id: string, name: string, presc = '3X10', sheetRow?: number): ProgramExercise => ({
  id, name, sectionType: 'progressione', restTimeSec: 90, weeks: { 1: presc, 2: presc }, sheetRow
});
const day = (id: string, exercises: ProgramExercise[]): ProgramDay => ({ id, title: `Giorno ${id.toUpperCase()}`, exercises });

const program: WorkoutProgram = {
  title: 'Scheda', athlete: '', trainer: '', totalWeeks: 2,
  guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [
    day('a', [ex('a1', 'Panca piana', '3X10', 5), ex('a2', 'Croci', '3X10', 6)]),
    day('b', [ex('b1', 'Squat', '4X8', 10), ex('b2', 'Leg press', '3X10', 11)]),
    day('c', [ex('c1', 'Stacco', '3X6', 15)])
  ],
  source: { tab: 'SCHEDA', weekCols: { 1: 3, 2: 4 }, annotate: true }
};

let n = 0;
function session(dayId: string, date: string, sets: Record<string, number>, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  const startedAt = Date.parse(`${date}T18:00:00`) + n++;
  return {
    id: `s${n}`, date, startedAt, endedAt: startedAt + 3_600_000, dayId, dayTitle: dayId, weekNumber: 1, durationMinutes: 60, totalVolumeKg: 0,
    sets: Object.entries(sets).flatMap(([exerciseId, count]) =>
      Array.from({ length: count }, (_, i) => ({ exerciseId, exerciseName: exerciseId, setIndex: i, weightKg: 40, reps: 10 }))),
    ...extra
  };
}

// mercoledì 4 novembre 2026: la settimana va da lunedì 2 a domenica 8
const TODAY = '2026-11-04';

describe('giorno bonus', () => {
  it('la settimana parte dal lunedì', () => {
    expect(mondayOf('2026-11-04')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('senza allenamenti in settimana non c\'è', () => {
    expect(computeBonusDay(program, [session('a', '2026-10-30', { a1: 1 })], TODAY)).toBeNull();
  });

  it('non compare se i giorni fatti sono completi e i successivi non sono ancora arrivati', () => {
    expect(computeBonusDay(program, [session('a', '2026-11-02', { a1: 3, a2: 3 })], TODAY)).toBeNull();
  });

  it('raccoglie le serie mancanti dei giorni fatti e i giorni precedenti saltati', () => {
    // fatto A a metà e poi C: B è saltato
    const sessions = [session('a', '2026-11-02', { a1: 3, a2: 1 }), session('c', '2026-11-04', { c1: 3 })];
    const bonus = computeBonusDay(program, sessions, TODAY)!;
    expect(bonus.day.id).toBe(BONUS_DAY_ID);
    expect(bonus.day.exercises.map((e) => e.id)).toEqual(['a2', 'b1', 'b2']);
    expect(bonus.doneBefore).toEqual({ a2: 1, b1: 0, b2: 0 });
    expect(bonus.day.subtitle).toContain('3 esercizi saltati');

    // nella bozza solo le serie che mancano
    const draft = buildDraft(bonus.day, bonus.week, sessions, bonus.doneBefore);
    expect(draft.sets.a2).toHaveLength(2);
    expect(draft.sets.b1).toHaveLength(4);
  });

  it('una volta fatto il bonus non resta più nulla e la sequenza della scheda non cambia', () => {
    const sessions = [session('a', '2026-11-02', { a1: 3, a2: 1 }), session('c', '2026-11-03', { c1: 3 })];
    const done = [...sessions, session(BONUS_DAY_ID, '2026-11-04', { a2: 2, b1: 4, b2: 3 })];
    expect(computeBonusDay(program, done, TODAY)).toBeNull();
    // dopo il bonus il prossimo resta quello dopo C
    expect(suggestNext(program, done)).toEqual(suggestNext(program, sessions));
  });

  it('gli allenamenti della settimana prima non contano', () => {
    const sessions = [session('a', '2026-10-31', { a1: 1 }), session('c', '2026-11-03', { c1: 3 })];
    expect(computeBonusDay(program, sessions, TODAY)!.day.exercises.map((e) => e.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('nel foglio del coach la cella tiene anche le serie fatte prima in settimana', () => {
    const before = session('a', '2026-11-02', { a2: 1 });
    before.sets[0].weightKg = 30;
    const bonus = session(BONUS_DAY_ID, '2026-11-04', {});
    bonus.sets = [1, 2].map((setIndex) => ({ exerciseId: 'a2', exerciseName: 'Croci', setIndex, weightKg: 32.5, reps: 10 }));
    const cells = planAnnotations(program, bonus, [before, bonus]);
    expect(cells).toEqual([expect.objectContaining({ a1: 'D6', value: '3X10 · 30/32,5/32,5 kg' })]);
  });
});
