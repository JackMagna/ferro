import { describe, expect, it } from 'vitest';
import type { Measurement, WorkoutSession } from '../../types';
import { bodyAlreadyThere, measurementsForHealthConnect, sessionInHealthConnect, sessionOnGoogleHealth, sessionsForHealthConnect } from '../healthTargets';

const session = (id: string, startedAt: number, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id, date: '2026-11-01', startedAt, endedAt: startedAt + 3_600_000, dayId: 'a', dayTitle: 'A', weekNumber: 1,
  durationMinutes: 60, totalVolumeKg: 1000, sets: [], ...extra
});

describe('allenamenti da mandare a Health Connect', () => {
  it('manda anche quelli vecchi e quelli già registrati su Google Health, dal più vecchio', () => {
    const list = [
      session('nuovo', 300, { healthSynced: false }),
      session('google', 200, { healthSynced: true, healthLogId: 'gh-123' }),
      session('vecchio', 100),
      session('gia-hc', 50, { hcSynced: true }),
      session('versione-vecchia-hc', 40, { healthSynced: true, healthLogId: 'hc' })
    ];
    expect(sessionsForHealthConnect(list).map((s) => s.id)).toEqual(['vecchio', 'google', 'nuovo']);
  });

  it('distingue Google Health da Health Connect', () => {
    expect(sessionOnGoogleHealth(session('g', 1, { healthSynced: true, healthLogId: 'gh-1' }))).toBe(true);
    expect(sessionOnGoogleHealth(session('h', 1, { healthSynced: true, healthLogId: 'hc' }))).toBe(false);
    expect(sessionInHealthConnect(session('h', 1, { healthSynced: true, healthLogId: 'hc' }))).toBe(true);
    expect(sessionInHealthConnect(session('g', 1, { healthSynced: true, healthLogId: 'gh-1' }))).toBe(false);
  });
});

describe('pesate da mandare a Health Connect', () => {
  const m = (id: string, date: string, extra: Partial<Measurement> = {}): Measurement => ({ id, date, ...extra });

  it('salta quelle senza peso, quelle già inviate e quelle lette da Health Connect', () => {
    const list = [
      m('peso', '2026-11-02', { weightKg: 80, healthSynced: true }),
      m('vita', '2026-11-01', { waistCm: 80 }),
      m('inviata', '2026-11-01', { weightKg: 80, hcSynced: true }),
      m('letta', '2026-11-01', { weightKg: 80, source: 'Health Connect' }),
      m('grasso', '2026-10-30', { bodyFat: 15 })
    ];
    expect(measurementsForHealthConnect(list).map((x) => x.id)).toEqual(['grasso', 'peso']);
  });

  it('riconosce una pesata già presente in Health Connect', () => {
    const existing = [{ date: '2026-11-02', weightKg: 80.04, bodyFat: 15 }];
    expect(bodyAlreadyThere(m('a', '2026-11-02', { weightKg: 80 }), existing)).toBe(true);
    expect(bodyAlreadyThere(m('b', '2026-11-02', { weightKg: 81 }), existing)).toBe(false);
    expect(bodyAlreadyThere(m('c', '2026-11-03', { weightKg: 80 }), existing)).toBe(false);
    expect(bodyAlreadyThere(m('d', '2026-11-02', { weightKg: 80, bodyFat: 18 }), existing)).toBe(false);
  });
});
