import { describe, expect, it } from 'vitest';
import { sessionToTCX, tcxFilename, tcxSport } from '../tcx';
import type { WorkoutSession } from '../../types';

const base: WorkoutSession = {
  id: 's', date: '2026-11-06', startedAt: Date.parse('2026-11-06T18:00:00Z'), endedAt: Date.parse('2026-11-06T18:40:00Z'),
  dayId: 'a', dayTitle: 'Giorno 1 – Gambe', weekNumber: 2, durationMinutes: 40, totalVolumeKg: 0, sets: []
};
const set = (exerciseName: string, x: Partial<WorkoutSession['sets'][number]> = {}) => ({ exerciseId: exerciseName, exerciseName, setIndex: 0, weightKg: 0, reps: 0, ...x });

describe('file TCX per Strava e Garmin', () => {
  it('corsa: sport, distanza, frequenza e due punti senza GPS', () => {
    const s = { ...base, avgBpm: 151.4, maxBpm: 178, sets: [set('Corsa', { distanceM: 5000, durationSec: 1500 }), set('Corsa', { distanceM: 1000, durationSec: 300 })] };
    expect(tcxSport(s)).toBe('Running');
    const xml = sessionToTCX(s);
    expect(xml).toContain('<Activity Sport="Running">');
    expect(xml).toContain('<TotalTimeSeconds>2400</TotalTimeSeconds>');
    expect(xml).toContain('<DistanceMeters>6000</DistanceMeters>');
    expect(xml).toContain('<AverageHeartRateBpm><Value>151</Value></AverageHeartRateBpm>');
    expect(xml).toContain('<MaximumHeartRateBpm><Value>178</Value></MaximumHeartRateBpm>');
    expect(xml.match(/<Trackpoint>/g)).toHaveLength(2);
    expect(xml).toContain('<Time>2026-11-06T18:40:00.000Z</Time><DistanceMeters>6000</DistanceMeters>');
    expect(xml).not.toContain('<Position>');
  });

  it('cyclette = bici, pesi = altro; caratteri speciali nelle note', () => {
    expect(tcxSport({ ...base, sets: [set('Cyclette', { durationSec: 1800 })] })).toBe('Biking');
    const gym = { ...base, dayTitle: 'Petto & spalle <A>', totalVolumeKg: 600, sets: [set('Panca piana', { weightKg: 60, reps: 10 })] };
    const xml = sessionToTCX(gym);
    expect(xml).toContain('<Activity Sport="Other">');
    expect(xml).toContain('<Notes>Petto &amp; spalle &lt;A&gt;. Ferro: 1 serie, 600 kg di volume</Notes>');
    expect(xml).not.toContain('HeartRateBpm');
  });

  it('nome del file con data e titolo', () => {
    expect(tcxFilename(base)).toBe('ferro-2026-11-06-giorno-1-gambe.tcx');
    expect(tcxFilename({ ...base, dayTitle: 'Più forza' })).toBe('ferro-2026-11-06-piu-forza.tcx');
  });
});
