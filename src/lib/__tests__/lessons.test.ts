import { describe, expect, it } from 'vitest';
import {
  buildIcs, googleCalendarUrl, isLessonSession, lessonActivity, lessonDone, lessonSession, lessonsOn, normalizeLesson, parseIcs, upcoming, whenLabel, type Lesson
} from '../lessons';
import { suggestNext } from '../../components/workout/draft';
import { computeBonusDay } from '../bonusDay';
import { workoutKind, workoutNotes } from '../workoutKind';
import type { WorkoutProgram, WorkoutSession } from '../../types';

const reformer: Lesson = { id: 'l1', title: 'Pilates reformer', weekday: 2, time: '18:30', durationMin: 50, place: 'Studio, sala 2', activity: 'pilates' };
const spinning: Lesson = { id: 'l2', title: 'Spinning', date: '2026-11-12', time: '07:00', durationMin: 45, activity: 'bici' };

describe('lezioni fisse', () => {
  it('scarta le lezioni senza titolo, ora o giorno e corregge la durata', () => {
    expect(normalizeLesson({ title: '', weekday: 1, time: '18:00' })).toBeNull();
    expect(normalizeLesson({ title: 'Yoga', weekday: 1, time: '25:00' })).toBeNull();
    expect(normalizeLesson({ title: 'Yoga', time: '18:00' })).toBeNull();
    expect(normalizeLesson({ title: ' Yoga ', weekday: 3, time: '18:00', durationMin: 2 })).toMatchObject({ title: 'Yoga', weekday: 3, durationMin: 5, activity: 'mobilita' });
  });

  it('riconosce la disciplina dal titolo', () => {
    expect(lessonActivity('Pilates reformer')).toBe('pilates');
    expect(lessonActivity('Spinning')).toBe('bici');
    expect(lessonActivity('Acquagym')).toBe('altro');
    expect(lessonActivity('Functional training')).toBe('forza');
  });

  it('trova le lezioni del giorno e la prossima', () => {
    // 10/11/2026 è martedì
    expect(lessonsOn([reformer, spinning], '2026-11-10').map((o) => o.lesson.id)).toEqual(['l1']);
    expect(lessonsOn([reformer, spinning], '2026-11-12').map((o) => o.lesson.id)).toEqual(['l2']);
    const next = upcoming([reformer, spinning], new Date('2026-11-10T19:30:00'));
    // la lezione delle 18:30 è finita alle 19:20: la prossima è lo spinning di giovedì
    expect(next[0].lesson.id).toBe('l2');
    expect(whenLabel(reformer)).toBe('Martedì 18:30');
  });

  it('una lezione fatta diventa un allenamento che non sposta la scheda', () => {
    const [o] = lessonsOn([reformer], '2026-11-10');
    const program = { days: [{ id: 'a', title: 'A', exercises: [] }, { id: 'b', title: 'B', exercises: [] }], totalWeeks: 4 } as unknown as WorkoutProgram;
    const gymDay = { id: 's0', date: '2026-11-09', startedAt: new Date('2026-11-09T18:00:00').getTime(), endedAt: 0, dayId: 'a', dayTitle: 'A', weekNumber: 2, durationMinutes: 60, totalVolumeKg: 0, sets: [] } satisfies WorkoutSession;
    const s = lessonSession(o, [gymDay]);
    expect(s).toMatchObject({ dayId: 'lezione', dayTitle: 'Pilates reformer', date: '2026-11-10', durationMinutes: 50, weekNumber: 2, sets: [] });
    expect(isLessonSession(s)).toBe(true);
    expect(lessonDone(o, [s])).toBe(true);
    // dopo il giorno A viene B, anche se nel mezzo c'è stata la lezione
    expect(suggestNext(program, [s, gymDay])).toEqual({ dayId: 'b', week: 2 });
    expect(computeBonusDay(program, [s], '2026-11-10')).toBeNull();
  });
});

describe('file .ics', () => {
  it('importa una lezione settimanale e una singola, con fuso e righe spezzate', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'UID:a', 'SUMMARY:Pilates\\, reformer', 'DTSTART;TZID=Europe/Rome:20261110T183000', 'DTEND;TZID=Europe/Rome:20261110T192000',
      'RRULE:FREQ=WEEKLY;BYDAY=TU', 'LOCATION:Studio Pila', ' tes', 'DESCRIPTION:Prenotazione n. 123 di Mario', 'END:VEVENT',
      'BEGIN:VEVENT', 'SUMMARY:Spinning', 'DTSTART:20261112T070000', 'DURATION:PT45M', 'END:VEVENT',
      'BEGIN:VEVENT', 'SUMMARY:Ferie', 'DTSTART;VALUE=DATE:20261201', 'END:VEVENT',
      'BEGIN:VEVENT', 'SUMMARY:Annullata', 'DTSTART:20261113T070000', 'STATUS:CANCELLED', 'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const list = parseIcs(ics);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ title: 'Pilates, reformer', weekday: 2, time: '18:30', durationMin: 50, place: 'Studio Pilates', activity: 'pilates' });
    expect(list[0].date).toBeUndefined();
    expect(list[1]).toMatchObject({ title: 'Spinning', date: '2026-11-12', time: '07:00', durationMin: 45 });
    // la descrizione (con dati personali) non viene letta
    expect(JSON.stringify(list)).not.toContain('Mario');
  });

  it('esporta con ripetizione, avviso e UID stabile, e si reimporta uguale', () => {
    const now = new Date('2026-11-06T10:00:00');
    const ics = buildIcs([reformer, spinning], now);
    expect(ics).toContain('UID:l1@ferro.app');
    expect(ics).toContain('DTSTART:20261110T183000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU');
    expect(ics).toContain('TRIGGER:-PT60M');
    expect(ics).toContain('LOCATION:Studio\\, sala 2');
    const back = parseIcs(ics);
    expect(back.map(({ id: _id, ...l }) => l)).toEqual([reformer, spinning].map(({ id: _id, ...l }) => l));
  });

  it('link di Google Calendar con ripetizione settimanale', () => {
    const url = new URL(googleCalendarUrl(reformer, new Date('2026-11-06T10:00:00')));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Pilates reformer');
    expect(url.searchParams.get('dates')).toBe('20261110T183000/20261110T192000');
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;BYDAY=TU');
  });
});

describe('tipo di allenamento per Health Connect', () => {
  const base = { id: 's', date: '2026-11-06', startedAt: 0, endedAt: 1, dayId: 'a', dayTitle: 'A', weekNumber: 1, durationMinutes: 40, totalVolumeKg: 0 };
  const set = (exerciseName: string, x: Partial<WorkoutSession['sets'][number]> = {}) => ({ exerciseId: exerciseName, exerciseName, setIndex: 0, weightKg: 0, reps: 0, ...x });

  it('pesi = forza, anche con un po\' di cardio', () => {
    const s = { ...base, totalVolumeKg: 600, sets: [set('Cyclette', { durationSec: 600 }), set('Panca piana', { weightKg: 60, reps: 10 })] };
    expect(workoutKind(s)).toBe('strength');
    expect(workoutNotes(s)).toBe('Ferro: 1 serie, 600 kg di volume');
  });

  it('solo cardio o solo nuoto: la disciplina', () => {
    expect(workoutKind({ ...base, sets: [set('Cyclette', { durationSec: 1800 })] })).toBe('biking_stationary');
    expect(workoutKind({ ...base, sets: [set('Corsa', { reps: 6, distanceM: 6000 })] })).toBe('running');
    expect(workoutKind({ ...base, sets: [set('Tapis roulant', { durationSec: 1200 })] })).toBe('running_treadmill');
    const swim = { ...base, sets: [set('Nuoto', { distanceM: 1500, durationSec: 2400 })] };
    expect(workoutKind(swim)).toBe('swimming_pool');
    expect(workoutNotes(swim)).toBe('Ferro: 1,5 km, 40 min');
  });

  it('blocchi senza pesi = HIIT; lezioni dal titolo', () => {
    expect(workoutKind({ ...base, sets: [set('Burpees'), set('Corsa', { distanceM: 200 })], blockResults: [{ blockId: 'b', title: 'AMRAP', kind: 'giri_rip', rounds: 5 }] })).toBe('hiit');
    const lesson = (dayTitle: string) => workoutKind({ ...base, dayId: 'lezione', dayTitle, sets: [] });
    expect(lesson('Pilates reformer')).toBe('pilates');
    expect(lesson('Spinning')).toBe('biking_stationary');
    expect(lesson('Yoga')).toBe('yoga');
    expect(lesson('Tabata')).toBe('hiit');
    expect(lesson('Acquagym')).toBe('exercise_class');
  });
});
