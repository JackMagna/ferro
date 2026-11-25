import { describe, expect, it } from 'vitest';
import { parseCoachSheet } from '../coachSheet';
import { planFor, plannedSetCount } from '../activity';
import { planAnnotations } from '../sheetWrite';
import { buildDraft } from '../../components/workout/draft';
import { normalizeProgram, normalizeSession } from '../../services/normalize';
import type { WorkoutSession } from '../../types';
import { row } from './fixtures';

const HEAD = (g: string) => row(g, 'NOTE', '1 SETT.', '2 SETT.');
const W = ['3X10', '4X10'];

/** Scheda mista: pesi, cardio, plank, corsa a ripetute e un blocco AMRAP. */
const MIXED: string[][] = [
  row('', 'SCHEDA MISTA'), row('', 'LUCIA • COACH LUCA'), row(''),
  HEAD('GIORNO 1'),                                        // 4
  row('CYCLETTE', 'riscaldamento', "10'", "15' Z2"),       // 5
  row("PROGRESSIONE SERIE X REP RIP. 2'", '', ...W),       // 6
  row('PANCA PIANA'),                                      // 7
  row('PLANK', '', "3x45''", "3x1'"),                      // 8
  row('CORSA', '', "6x1000 r 2'", '5 km'),                 // 9
  row("AMRAP 12'"),                                        // 10
  row('WALL BALL', '', '15', '20'),                        // 11
  row('BURPEES', '', '10', '12'),                          // 12
  row('ROW', '', '200 m', '250 m'),                        // 13
  row(''),
  HEAD('GIORNO 2'),                                        // 15
  row('NUOTO', '', "400 risc + 8x50 SL r 15'' + 200 def", '1500')
];

describe('scheda mista dal foglio del coach', () => {
  const { program } = parseCoachSheet(MIXED, 'SCHEDA');
  const [g1, g2] = program.days;
  const byName = (n: string) => g1.exercises.find((e) => e.name.toLowerCase() === n)!;

  it('tiene le celle a tempo e distanza invece di scartarle', () => {
    expect(byName('cyclette').weeks).toEqual({ 1: "10'", 2: "15' Z2" });
    expect(byName('corsa').weeks).toEqual({ 1: "6x1000 r 2'", 2: '5 km' });
    expect(byName('plank').weeks).toEqual({ 1: "3x45''", 2: "3x1'" });
    // i pesi restano come prima: prescrizione della sezione e celle per i carichi
    expect(byName('panca piana')).toMatchObject({ weeks: { 1: '3X10', 2: '4X10' }, cellMode: 'loads' });
  });

  it('riconosce il blocco AMRAP e i suoi esercizi', () => {
    expect(g1.blocks).toEqual([expect.objectContaining({ id: 'b-1-1', format: 'amrap', durationSec: 720, title: "Amrap 12'" })]);
    const inBlock = g1.exercises.filter((e) => e.blockId === 'b-1-1').map((e) => e.name);
    expect(inBlock).toEqual(['Wall ball', 'Burpees', 'Row']);
    expect(byName('wall ball').weeks).toEqual({ 1: '15', 2: '20' });
  });

  it('ogni riga ha il suo tipo', () => {
    expect(planFor(byName('cyclette'), 1)).toMatchObject({ kind: 'tempo', timeSec: 600 });
    expect(planFor(byName('panca piana'), 1)).toEqual({ kind: 'carico' });
    expect(planFor(byName('plank'), 2)).toEqual({ kind: 'tenuta', sets: 3, timeSec: 60 });
    expect(planFor(byName('corsa'), 1)).toMatchObject({ kind: 'intervalli', reps: 6, workM: 1000 });
    expect(planFor(byName('wall ball'), 1)).toEqual({ kind: 'blocco', text: '15' });
    expect(planFor(g2.exercises[0], 1)).toMatchObject({ kind: 'nuoto', totalM: 1000 });
  });

  it('la bozza prepara una voce per il cardio e le tenute in secondi', () => {
    const draft = buildDraft(g1, 1, []);
    expect(draft.sets[byName('cyclette').id]).toEqual([{ weightKg: 0, reps: 0, completed: false, durationSec: 600 }]);
    expect(draft.sets[byName('corsa').id]).toEqual([{ weightKg: 0, reps: 6, completed: false, distanceM: 6000, durationSec: undefined }]);
    expect(draft.sets[byName('plank').id]).toHaveLength(3);
    expect(draft.sets[byName('plank').id][0]).toMatchObject({ durationSec: 45, reps: 0 });
    expect(draft.sets[byName('panca piana').id]).toHaveLength(3);
    expect(plannedSetCount(byName('cyclette'), 1)).toBe(1);
    expect(plannedSetCount(byName('plank'), 1)).toBe(3);
  });

  it('nel foglio si scrivono solo i carichi delle righe da palestra', () => {
    const session = {
      id: 's1', date: '2026-11-05', startedAt: 1, endedAt: 2, dayId: g1.id, dayTitle: g1.title, weekNumber: 1, durationMinutes: 60, totalVolumeKg: 0,
      sets: [
        { exerciseId: byName('panca piana').id, exerciseName: 'Panca piana', setIndex: 0, weightKg: 60, reps: 10 },
        { exerciseId: byName('cyclette').id, exerciseName: 'Cyclette', setIndex: 0, weightKg: 0, reps: 0, durationSec: 600 },
        { exerciseId: byName('plank').id, exerciseName: 'Plank', setIndex: 0, weightKg: 0, reps: 0, durationSec: 45 }
      ]
    } satisfies WorkoutSession;
    expect(planAnnotations(program, session).map((c) => c.exerciseName)).toEqual(['Panca piana']);
  });

  it('i campi nuovi sopravvivono al salvataggio', () => {
    const saved = normalizeProgram(JSON.parse(JSON.stringify(program)));
    expect(saved.days[0].blocks?.[0]).toMatchObject({ format: 'amrap', durationSec: 720 });
    expect(saved.days[0].exercises.find((e) => e.name === 'Row')?.blockId).toBe('b-1-1');
    const session = normalizeSession({
      id: 's', date: '2026-11-05', dayId: 'g', sets: [{ exerciseId: 'a', exerciseName: 'Corsa', setIndex: 0, weightKg: 0, reps: 6, distanceM: 6000, durationSec: 1800 }],
      blockResults: [{ blockId: 'b-1-1', title: 'AMRAP', kind: 'giri_rip', rounds: 5, reps: 12, rx: true }]
    });
    expect(session.sets[0]).toMatchObject({ distanceM: 6000, durationSec: 1800 });
    expect(session.blockResults).toEqual([{ blockId: 'b-1-1', title: 'AMRAP', kind: 'giri_rip', rounds: 5, reps: 12, rx: true, timeSec: undefined, notes: undefined }]);
  });
});
