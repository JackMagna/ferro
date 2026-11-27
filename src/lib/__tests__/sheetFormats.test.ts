import { describe, expect, it } from 'vitest';
import { parseCoachSheet, cleanCell } from '../coachSheet';
import { describePrescription, parsePrescription } from '../prescription';
import { parseActivity } from '../activity';
import { NOT_PRESCRIPTIONS, PRESCRIPTIONS, SHEETS } from './sheetFormats';

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
