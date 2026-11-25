import { describe, expect, it } from 'vitest';
import { clock, estimateCalories, isoDay, mergeBody, summarizeHeartRate } from '../healthMath';

describe('frequenza cardiaca', () => {
  it('calcola media e massima ignorando valori impossibili', () => {
    const pts = [60, 90, 120, 150, 0, 300].map((value, i) => ({ time: `10:0${i}:00`, value }));
    expect(summarizeHeartRate(pts)).toEqual({ avg: 105, max: 150 });
  });
  it('restituisce null con troppi pochi dati', () => {
    expect(summarizeHeartRate([{ time: '10:00:00', value: 100 }])).toBeNull();
    expect(summarizeHeartRate([])).toBeNull();
  });
});

describe('calorie', () => {
  it('usa la frequenza media quando c\'è', () => {
    expect(estimateCalories({ minutes: 60, avgBpm: 120, weightKg: 75, age: 30 })).toBe(Math.round(((-55.0969 + 0.6309 * 120 + 0.1988 * 75 + 0.2017 * 30) / 4.184) * 60));
  });
  it('altrimenti stima con 3,5 MET', () => {
    expect(estimateCalories({ minutes: 60, weightKg: 80 })).toBe(280);
    expect(estimateCalories({ minutes: 0 })).toBe(0);
  });
});

describe('pesate e orari', () => {
  it('unisce peso e grasso, uno per giorno, in ordine', () => {
    const out = mergeBody(
      [{ date: '2026-10-02', weight: 80.04 }, { date: '2026-10-01', weight: 81.2 }, { date: '2026-10-02', weight: 79.96 }],
      [{ date: '2026-10-02', fat: 14.26 }]
    );
    expect(out).toEqual([{ date: '2026-10-01', weightKg: 81.2, bodyFat: undefined }, { date: '2026-10-02', weightKg: 80, bodyFat: 14.3 }]);
  });
  it('formatta data e ora locali', () => {
    const ms = new Date(2026, 9, 19, 7, 5, 9).getTime();
    expect(isoDay(ms)).toBe('2026-10-19');
    expect(clock(ms)).toBe('07:05');
    expect(clock(ms, true)).toBe('07:05:09');
  });
});
