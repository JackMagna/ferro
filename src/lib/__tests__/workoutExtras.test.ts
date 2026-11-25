import { describe, expect, it } from 'vitest';
import { decimalText, parseTyped, stepButtons } from '../weightStep';
import { applyCommunityLinks, communityChoice, linkByName, linkKey, tallyVotes } from '../exerciseLinks';
import { workoutNoticeState } from '../workoutNotice';
import { formatLoad } from '../ids';
import { normalizeProgram } from '../../services/normalize';
import type { ProgramExercise, WorkoutProgram } from '../../types';

describe('carico scritto a mano', () => {
  it('accetta virgola, punto, spazi e unità', () => {
    expect(parseTyped('22,5')).toBe(22.5);
    expect(parseTyped('1.125')).toBe(1.125);
    expect(parseTyped(' 80 kg ')).toBe(80);
    expect(parseTyped(',5')).toBe(0.5);
    expect(parseTyped('80,')).toBe(80);
  });
  it('rifiuta ciò che non è un numero', () => {
    expect(parseTyped('')).toBeUndefined();
    expect(parseTyped('abc')).toBeUndefined();
    expect(parseTyped('1,2,3')).toBeUndefined();
    expect(parseTyped('-5')).toBeUndefined();
  });
  it('mostra la virgola e non arrotonda i dischi frazionari', () => {
    expect(decimalText(22.5)).toBe('22,5');
    expect(decimalText(1.125)).toBe('1,125');
    expect(decimalText(0.1 + 0.2)).toBe('0,3');
    expect(formatLoad(21.25)).toBe('21,25');
  });
  it('pulsanti dal passo scelto', () => {
    expect(stepButtons(2.5)).toEqual([2.5, 5, 10]);
    expect(stepButtons(1)).toEqual([1, 2, 4]);
  });
});

const ex = (id: string, name: string, extra: Partial<ProgramExercise> = {}): ProgramExercise => ({ id, name, sectionType: 'progressione', restTimeSec: 90, weeks: { 1: '3X10' }, ...extra });
const program = (exercises: ProgramExercise[]): WorkoutProgram => ({
  title: 'S', athlete: '', trainer: '', totalWeeks: 1, guidelines: { modalitaEsecuzione: [], progressione: '', cedimento: '' },
  days: [{ id: 'a', title: 'A', exercises }]
});

describe('collegamenti condivisi', () => {
  it('la chiave ignora maiuscole, accenti e parole vuote', () => {
    expect(linkKey('Panca piana con bilanciere')).toBe(linkKey('panca PIANA bilanciere'));
    expect(linkKey('Alzate laterali')).toMatch(/^[a-z0-9-]+$/);
    expect(linkKey('  ')).toBe('');
  });
  it('decide solo con almeno 2 voti e il 60%', () => {
    expect(communityChoice(tallyVotes([{ libraryId: 'A' }]))).toBeUndefined();
    expect(communityChoice(tallyVotes([{ libraryId: 'A' }, { libraryId: 'A' }]))).toBe('A');
    expect(communityChoice(tallyVotes([{ libraryId: 'A' }, { libraryId: 'A' }, { libraryId: 'B' }, { libraryId: 'B' }]))).toBeUndefined();
    expect(communityChoice(tallyVotes([{ libraryId: '' }, { libraryId: '' }, { libraryId: 'A' }]))).toBe('');
    expect(tallyVotes([{ libraryId: 'B' }, { libraryId: 'A' }, { libraryId: 'B' }])).toEqual([{ libraryId: 'B', votes: 2 }, { libraryId: 'A', votes: 1 }]);
  });
  it('non tocca gli esercizi collegati a mano', () => {
    const p = program([ex('1', 'Panca piana', { libraryId: 'X' }), ex('2', 'Panca piana', { libraryId: 'Y', linkedBy: 'utente' }), ex('3', 'Squat')]);
    const r = applyCommunityLinks(p, new Map([[linkKey('Panca piana'), 'Bench']]))!;
    expect(r.changed).toBe(1);
    expect(r.program.days[0].exercises.map((e) => [e.libraryId, e.linkedBy])).toEqual([['Bench', 'comunita'], ['Y', 'utente'], [undefined, undefined]]);
    expect(applyCommunityLinks(r.program, new Map([[linkKey('Panca piana'), 'Bench']]))).toBeNull();
  });
  it('la scelta a mano vale per tutti gli esercizi con lo stesso nome', () => {
    const p = linkByName(program([ex('1', 'Panca piana'), ex('2', 'panca  piana'), ex('3', 'Squat', { libraryId: 'S' })]), 'Panca piana', undefined);
    expect(p.days[0].exercises.map((e) => [e.libraryId, e.linkedBy])).toEqual([[undefined, 'utente'], [undefined, 'utente'], ['S', undefined]]);
    expect(normalizeProgram(p)?.days[0].exercises[0].linkedBy).toBe('utente');
  });
});

describe('notifica dell\'allenamento', () => {
  const sets = [{ weightKg: 80, reps: 8, completed: true }, { weightKg: 82.5, reps: 8, completed: false }];
  it('mostra esercizio, serie, carico e recupero', () => {
    const s = workoutNoticeState({ dayTitle: 'Giorno A', exercise: ex('1', 'Panca piana'), sets, setIndex: 1, prescription: '3X8', done: 1, total: 10, restEndAt: Date.now() + 60_000, alert: true });
    expect(s.title).toBe('Panca piana · serie 2 di 2');
    expect(s.text).toBe('82,5 kg × 8 · 3X8');
    expect(s.restText).toBe('Recupero · poi 82,5 kg × 8');
    expect(s.sub).toBe('Giorno A · 1 di 10 serie');
    expect(s.endAt).toBeGreaterThan(Date.now());
    expect(s.endText).toBe('Panca piana, serie 2: 82,5 kg × 8');
  });
  it('senza recupero in corso non programma l\'avviso', () => {
    const s = workoutNoticeState({ dayTitle: 'A', exercise: ex('1', 'Squat'), sets, setIndex: 1, done: 1, total: 2, restEndAt: Date.now() - 1000, alert: true });
    expect(s.endAt).toBe(0);
  });
});
