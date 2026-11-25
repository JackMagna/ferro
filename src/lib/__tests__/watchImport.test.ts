import { describe, expect, it } from 'vitest';
import { watchLabel, watchSessions, type WatchWorkout } from '../watchImport';
import { suggestNext } from '../../components/workout/draft';
import { computeBonusDay } from '../bonusDay';
import { workoutKind } from '../workoutKind';
import type { WorkoutProgram, WorkoutSession } from '../../types';

const run: WatchWorkout = {
  workoutType: 'running', duration: 1800, startDate: '2026-11-04T06:30:00.000Z', endDate: '2026-11-04T07:00:00.000Z',
  totalDistance: 5012.4, sourceId: 'com.garmin.android.apps.connectmobile', sourceName: 'Garmin Forerunner', platformId: 'abc-123'
};
const gym: WorkoutSession = {
  id: 's0', date: '2026-11-05', startedAt: Date.parse('2026-11-05T17:00:00Z'), endedAt: Date.parse('2026-11-05T18:00:00Z'),
  dayId: 'a', dayTitle: 'A', weekNumber: 3, durationMinutes: 60, totalVolumeKg: 1000, sets: []
};

describe('import dall\'orologio (Health Connect)', () => {
  it('trasforma una corsa in una seduta fuori scheda, già in Health Connect', () => {
    const [s] = watchSessions([run], [gym]);
    expect(s).toMatchObject({
      id: 'hc-abc-123', date: '2026-11-04', dayId: 'orologio', dayTitle: 'Corsa', weekNumber: 3, durationMinutes: 30,
      totalVolumeKg: 0, healthSynced: true, healthLogId: 'hc'
    });
    expect(s.sets).toEqual([{ exerciseId: 'orologio', exerciseName: 'Corsa', setIndex: 0, weightKg: 0, reps: 0, durationSec: 1800, distanceM: 5012 }]);
    expect(workoutKind(s)).toBe('running');
  });

  it('salta le attività di Ferro, quelle già importate e quelle sovrapposte a una seduta', () => {
    const ferro = { ...run, platformId: 'f1', sourceId: 'it.irontrack.app' };
    const ferroTest = { ...run, platformId: 'f2', sourceId: 'it.irontrack.app.test' };
    const sameGym = { ...run, workoutType: 'strengthTraining' as const, platformId: 'g1', startDate: '2026-11-05T17:05:00.000Z', endDate: '2026-11-05T18:02:00.000Z' };
    const already = watchSessions([run], [])[0];
    expect(watchSessions([ferro, ferroTest, sameGym, run], [gym, already])).toEqual([]);
    expect(watchSessions([run, run], [])).toHaveLength(1);
  });

  it('non sposta la rotazione dei giorni né il giorno bonus', () => {
    const program = { days: [{ id: 'a', title: 'A', exercises: [] }, { id: 'b', title: 'B', exercises: [] }], totalWeeks: 4 } as unknown as WorkoutProgram;
    const later = watchSessions([{ ...run, platformId: 'z', startDate: '2026-11-06T06:00:00.000Z', endDate: '2026-11-06T06:40:00.000Z' }], [gym]);
    expect(suggestNext(program, [...later, gym])).toEqual({ dayId: 'b', week: 3 });
    expect(computeBonusDay(program, later, '2026-11-06')).toBeNull();
  });

  it('nomi italiani; distanza trascurabile ignorata', () => {
    expect(watchLabel('swimmingPool')).toBe('Nuoto in piscina');
    expect(watchLabel('bikingStationary')).toBe('Cyclette');
    expect(watchLabel('qualcosa')).toBe('Allenamento');
    const [yoga] = watchSessions([{ ...run, workoutType: 'yoga', totalDistance: 3, platformId: 'y' }], []);
    expect(yoga.sets[0].distanceM).toBeUndefined();
    expect(yoga.dayTitle).toBe('Yoga');
  });
});
