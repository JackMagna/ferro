import { describe, expect, it } from 'vitest';
import { buildWidgetData } from '../widgetData';
import { DEFAULT_PROGRAM } from '../../data/defaultProgram';
import type { FoodEntry, WorkoutSession } from '../../types';

const now = new Date('2026-10-28T10:00:00');
const session = (dayId: string, week: number, date: string): WorkoutSession => ({
  id: date, date, startedAt: Date.parse(`${date}T18:00:00`), endedAt: Date.parse(`${date}T19:00:00`),
  dayId, dayTitle: '', weekNumber: week, durationMinutes: 60, totalVolumeKg: 0, sets: []
});
const meal = (kcal: number, date = '2026-10-28'): FoodEntry => ({ id: String(kcal), date, mealType: 'pranzo', name: 'x', kcal, proteinG: 30, carbsG: 50, fatG: 10 });

describe('dati dei widget', () => {
  const base = { program: DEFAULT_PROGRAM, meals: [], dietPlan: null, consented: true, draft: null, now };

  it('senza allenamenti propone il primo giorno, settimana 1', () => {
    const d = buildWidgetData({ ...base, sessions: [] });
    expect(d.workout).toMatchObject({ day: DEFAULT_PROGRAM.days[0].title, week: 1, inProgress: false });
    expect(d.workout!.exercises[0]).toEqual({ name: DEFAULT_PROGRAM.days[0].exercises[0].name, sets: '3×10' });
    expect(d.lastWorkoutAt).toBeNull();
  });

  it('dopo un allenamento propone il giorno successivo e ricorda quando', () => {
    const s = session(DEFAULT_PROGRAM.days[0].id, 2, '2026-10-25');
    const d = buildWidgetData({ ...base, sessions: [s] });
    expect(d.workout).toMatchObject({ day: DEFAULT_PROGRAM.days[1].title, week: 2 });
    expect(d.lastWorkoutAt).toBe(s.startedAt);
  });

  it('allenamento in corso: mostra quello', () => {
    const day = DEFAULT_PROGRAM.days[1];
    const draft = { dayId: day.id, week: 3, startedAt: 1, sets: { a: [{ weightKg: 40, reps: 10, completed: true }] }, exIndex: 0, setIndex: 1, hr: { sum: 0, count: 0, max: 0 } };
    const d = buildWidgetData({ ...base, sessions: [], draft: draft as never });
    expect(d.workout).toMatchObject({ day: day.title, week: 3, inProgress: true });
  });

  it('pasti di oggi solo con il consenso', () => {
    const meals = [meal(500), meal(300), meal(900, '2026-10-27')];
    const d = buildWidgetData({ ...base, sessions: [], meals });
    expect(d.meals).toMatchObject({ date: '2026-10-28', kcal: 800, proteinG: 60 });
    const locked = buildWidgetData({ ...base, sessions: [], meals, consented: false });
    expect(locked.meals).toBeNull();
    expect(locked.mealsLocked).toBe(true);
  });
});
