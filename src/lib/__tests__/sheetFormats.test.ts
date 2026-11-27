import { describe, expect, it } from 'vitest';
import { parseCoachSheet, cleanCell, isAthleteLog } from '../coachSheet';
import { parseMeasuresTab } from '../measuresSheet';
import { describePrescription, parsePrescription } from '../prescription';
import { parseActivity } from '../activity';
import { COACH_B, COACH_B_MISURE, NOT_PRESCRIPTIONS, PRESCRIPTIONS, SHEETS } from './sheetFormats';

describe('prescrizioni scritte in modi diversi', () => {
  it.each(PRESCRIPTIONS)('$text', ({ text, reps, repsMax, extra }) => {
    const p = parsePrescription(text);
    expect(p.understood).toBe(true);
    expect(p.reps).toEqual(reps);
    expect(p.sets).toBe(reps.length);
    expect(p.repsMax).toEqual(repsMax);
    if (extra) expect(p).toMatchObject(extra);
    expect(parseActivity(text, 'forza').kind).toBe('carico'); // in allenamento: serie con carico, non testo
    expect(cleanCell(text)).toBe(text); // nel foglio non viene scartata
  });
  it.each(NOT_PRESCRIPTIONS)('%s: non la capisce e lo dice', (text) => {
    const p = parsePrescription(text);
    expect(p.understood).toBe(false);
    expect(describePrescription(text)).toBe('non la capisco: propongo 3 × 10');
  });
  it('legge il tempo di esecuzione anche quando non ci sono serie', () => {
    expect(parsePrescription('3-1-1-0').tempo).toBe('3-1-1-0');
    expect(parsePrescription('4-3-2-1')).toMatchObject({ understood: true, reps: [4, 3, 2, 1] }); // senza 0 né X è una piramide
  });
  it('carichi scritti a mano restano carichi', () => {
    expect(cleanCell('40/42')).toBe('');
    expect(cleanCell('12/14/16')).toBe(''); // in salita: manubri, non ripetizioni
    expect(cleanCell('12,5')).toBe('');
    expect(cleanCell('40/42,5 kg')).toBe('');
  });
});

describe('fogli in formati diversi', () => {
  for (const s of SHEETS.filter((x) => x.today)) {
    it(`${s.name}: lo legge`, () => {
      const { program, warnings } = parseCoachSheet(s.rows, 'Prova');
      expect(warnings).toEqual([]);
      const ex = program.days.flatMap((d) => d.exercises);
      expect(ex.length).toBe(s.rows.filter((r, i) => i > 0 && r[0]).length);
      for (const e of ex) for (const v of Object.values(e.weeks)) expect(parsePrescription(v).understood).toBe(true);
    });
  }
  it('il recupero scritto nella cella vale per l\'esercizio', () => {
    const ex = parseCoachSheet([['GIORNO 1', 'NOTE', '1 SETT.'], ['PANCA', '', '4X8 rec 90"'], ['SQUAT', '', '5x5']], 'Prova').program.days[0].exercises;
    expect(ex.map((e) => e.restTimeSec)).toEqual([90, 120]);
  });
  // prossimi passi del lettore (vedi il rapporto sulla lettura delle schede)
  for (const s of SHEETS.filter((x) => !x.today)) it.todo(`${s.name}: da leggere`);
});

describe('scheda di un secondo coach (struttura vera, dati inventati)', () => {
  const { program, warnings } = parseCoachSheet(COACH_B, 'Prova');
  const [d1, d2, d3] = program.days.map((d) => d.exercises);

  it('legge titolo e trainer anche senza il nome dell\'atleta', () => {
    expect(program.title).toBe('Programma palestra');
    expect(program.athlete).toBe('');
    expect(program.trainer).toBe('Luca personal trainer');
  });
  it('trova tutte le settimane, anche con «6 SETT.» ripetuto', () => {
    expect(program.totalWeeks).toBe(8);
    expect(program.source?.weekCols).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 });
    expect(warnings).toEqual([]);
  });
  it('«SERIE X REP RIP. 2\'» è una sezione, non un esercizio', () => {
    expect(d1.map((e) => e.name)).toEqual(['Distensioni multipower piana', 'Rematore manubri panca 30', 'Croci manubri inclinata', 'Alzate laterali piedi']);
    expect(d2.map((e) => e.name)).toEqual(['Pressa 45', 'Curl bilanciere panca scott', 'Dannunzio', 'Rotella']);
  });
  it('gli esercizi prendono la forbice della sezione, non quello che ha scritto l\'atleta', () => {
    expect(d1[0]).toMatchObject({ restTimeSec: 120, cellMode: 'loads', sheetRow: 7 });
    expect(d1[0].weeks).toEqual({ 1: '2X5/7', 2: '2X5/7', 3: '2X5/7', 4: '2X5/7', 5: '2X5/7', 6: '2X5/7', 7: '2X5/7', 8: '2X5/7' });
    expect(d1[3].weeks[7]).toBe('2X7/9');
    expect(d2[2].weeks[3]).toBe('3X9/11'); // «11/10/8...» scritto dall'atleta non conta
    expect(parsePrescription(d1[0].weeks[1])).toMatchObject({ sets: 2, reps: [5, 5], repsMax: [7, 7] });
  });
  it('JUMP SET con il recupero in secondi e la sezione senza titolo', () => {
    expect(d3.map((e) => [e.name, e.weeks[1], e.restTimeSec])).toEqual([
      ['Lento avanti multipower', '2x8/10', 90],
      ['Chest press presa sotto', '2x10/12', 90],
      ['Crunch cavo', undefined, 120]
    ]);
  });
  it('quello che scrive l\'atleta non è una prescrizione', () => {
    for (const v of ['72. 7-6', '14/16 all. 11-9', '18 cavi b. 12-12', '10sed. 10-10', '4/5 lat p. 45. 12-10-10', '60 squat 10-9']) {
      expect(isAthleteLog(v)).toBe(true);
      expect(cleanCell(v)).toBe('');
    }
    for (const v of ['10-9-8..', '10 - 8 - 6', '2X5/7', '4xMAX', '3 serie da 10']) expect(isAthleteLog(v)).toBe(false);
    expect(cleanCell("20' Z2")).toBe("20' Z2"); // tempo e zona: resta
  });
  it('legge le misure con «SETTIMANE» e i numeri soli', () => {
    const { layout, values } = parseMeasuresTab(COACH_B_MISURE);
    expect(layout.weekCols).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4 });
    expect(values[3]?.weightKg).toBe(80.6);
    expect(values[4]?.abdomenCm).toBe(87.5);
  });
});
