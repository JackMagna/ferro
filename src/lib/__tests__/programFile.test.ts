import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRAM } from '../../data/defaultProgram';
import { blankProgram, parseProgramFile, programFile } from '../programFile';

describe('file della scheda', () => {
  it('esporta e reimporta la stessa scheda, senza il collegamento al foglio', () => {
    const withSource = { ...DEFAULT_PROGRAM, source: { kind: 'coach-sheet' } as never, startDate: '2026-11-02' };
    const back = parseProgramFile(JSON.parse(programFile(withSource)));
    const { source: _s, updatedAt: _u, startDate: _d, ...plain } = DEFAULT_PROGRAM;
    expect(back).toEqual(plain);
    expect(back && 'source' in back).toBe(false);
  });

  it('legge la scheda anche da un backup completo', () => {
    expect(parseProgramFile({ app: 'irontrack', version: 2, program: DEFAULT_PROGRAM })?.title).toBe(DEFAULT_PROGRAM.title);
  });

  it('rifiuta file che non sono schede', () => {
    expect(parseProgramFile(null)).toBeNull();
    expect(parseProgramFile({ app: 'altro', program: DEFAULT_PROGRAM })).toBeNull();
    expect(parseProgramFile({ app: 'ferro-scheda', program: { days: 'no' } })).toBeNull();
  });

  it('corregge settimane assurde e campi mancanti', () => {
    const p = parseProgramFile({ app: 'ferro-scheda', program: { totalWeeks: 400, days: [] } });
    expect(p).toMatchObject({ title: '', totalWeeks: 4, guidelines: { modalitaEsecuzione: [] } });
  });

  it('la scheda vuota ha un giorno senza esercizi', () => {
    expect(blankProgram().days).toHaveLength(1);
    expect(blankProgram().days[0].exercises).toEqual([]);
  });
});
