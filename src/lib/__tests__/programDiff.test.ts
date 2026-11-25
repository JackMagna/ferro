import { describe, expect, it } from 'vitest';
import { diffPrograms, programFingerprint } from '../programDiff';
import { parseCoachSheet } from '../coachSheet';
import { prepareImported } from '../coachImport';
import { SHEET } from './fixtures';
import type { WorkoutProgram } from '../../types';

const clone = <T,>(v: T): T => structuredClone(v);
const base = (): WorkoutProgram => parseCoachSheet(SHEET, 'SCHEDA').program;

describe('modifiche del coach', () => {
  it('stessa scheda: stessa impronta e nessuna differenza', () => {
    expect(programFingerprint(base())).toBe(programFingerprint(base()));
    expect(diffPrograms(base(), base())).toEqual([]);
  });

  it('i carichi scritti da Ferro nel foglio non contano come modifica', () => {
    const annotated = SHEET.map((r) => r.map((c) => (/^\d+X\d+/i.test(c) ? `${c} · 40 kg` : c)));
    expect(programFingerprint(parseCoachSheet(annotated, 'SCHEDA').program)).toBe(programFingerprint(base()));
  });

  it('id e collegamenti alla libreria non contano', () => {
    const a = base();
    const b = clone(a);
    b.days[0].exercises[0].libraryId = 'Leg_Press';
    b.days[0].exercises[0].id = 'altro';
    expect(diffPrograms(a, b)).toEqual([]);
  });

  it('elenca serie, esercizi nuovi e tolti, note e recuperi', () => {
    const a = base();
    const b = clone(a);
    const day = b.days[0];
    const first = day.exercises[0];
    first.weeks = { ...first.weeks, 3: '5X5' };
    first.restTimeSec = 90;
    first.note = 'Discesa lenta';
    const removed = day.exercises.splice(1, 1)[0];
    day.exercises.push({ ...first, id: 'n', name: 'Face pull', weeks: { 1: '3X15' } });
    b.totalWeeks = a.totalWeeks + 2;
    const texts = diffPrograms(a, b).map((c) => c.text);
    expect(texts).toContain(`${first.name}, sett. 3: ${a.days[0].exercises[0].weeks[3]} → 5X5`);
    expect(texts).toContain(`${first.name}: recupero ${a.days[0].exercises[0].restTimeSec} → 90 s`);
    expect(texts).toContain(`${first.name}: nota «Discesa lenta»`);
    expect(texts).toContain('Nuovo: Face pull (3X15)');
    expect(texts).toContain(`Tolto: ${removed.name}`);
    expect(texts).toContain(`Settimane: ${a.totalWeeks} → ${b.totalWeeks}`);
    expect(programFingerprint(b)).not.toBe(programFingerprint(a));
  });

  it('giorni aggiunti e tolti', () => {
    const a = base();
    const b = clone(a);
    const gone = b.days.pop()!;
    b.days.push({ id: 'giorno-9', title: 'Giorno 9', exercises: [] });
    const changes = diffPrograms(a, b);
    expect(changes).toContainEqual({ day: 'Giorno 9', text: 'Giorno nuovo con 0 esercizi' });
    expect(changes).toContainEqual({ day: gone.title, text: 'Giorno tolto' });
  });

  it('aggiornando si tengono data di inizio e impostazioni e si salva l\'impronta', () => {
    const current = { ...base(), startDate: '2026-10-01' };
    current.source = { ...current.source!, annotate: false, measuresTab: 'MISURE' };
    const next = clone(base());
    next.days[0].exercises[0].weeks[1] = '5X5';
    const out = prepareImported(next, current, [], { measuresTab: 'MISURE', annotate: false });
    expect(out.startDate).toBe('2026-10-01');
    expect(out.source).toMatchObject({ annotate: false, measuresTab: 'MISURE', fingerprint: programFingerprint(next) });
    expect(out.days[0].exercises[0].id).toBe(current.days[0].exercises[0].id);
  });
});
