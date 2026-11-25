import { describe, expect, it } from 'vitest';
import { formatClock, plannedSec, timerPlan, timerState } from '../blockTimer';
import { parseBlockHeader } from '../activity';
import type { ProgramBlock } from '../../types';

const block = (raw: string): ProgramBlock => ({ id: 'b', ...parseBlockHeader(raw)! });
const at = (sec: number) => sec * 1000;

describe('timer dei blocchi', () => {
  it('Tabata: 10" di pronti, 8 × 20" lavoro / 10" recupero, senza recupero finale', () => {
    const p = timerPlan(block('Tabata'))!;
    expect(plannedSec(p)).toBe(8 * 20 + 7 * 10);
    expect(timerState(p, at(3))).toMatchObject({ phase: 'pronti', left: 7 });
    expect(timerState(p, at(10))).toMatchObject({ phase: 'lavoro', round: 1, left: 20 });
    expect(timerState(p, at(31))).toMatchObject({ phase: 'recupero', round: 1, left: 9 });
    expect(timerState(p, at(40))).toMatchObject({ phase: 'lavoro', round: 2, left: 20 });
    expect(timerState(p, at(10 + 230 - 1))).toMatchObject({ phase: 'lavoro', round: 8, left: 1 });
    expect(timerState(p, at(10 + 230))).toMatchObject({ phase: 'fine', elapsed: 230 });
  });

  it('EMOM 10: un minuto per volta, «Minuto 3 di 10»', () => {
    const p = timerPlan(block('EMOM 10'))!;
    expect(p).toMatchObject({ rounds: 10, roundLabel: 'Minuto' });
    expect(timerState(p, at(10 + 125))).toMatchObject({ phase: 'lavoro', round: 3, rounds: 10, left: 55 });
    expect(timerState(p, at(10 + 600)).phase).toBe('fine');
    const every2 = timerPlan(block("Ogni 2' x 5"))!;
    expect(every2).toMatchObject({ rounds: 5, roundLabel: 'Giro' });
    expect(plannedSec(every2)).toBe(600);
  });

  it('AMRAP 12 a scendere; For Time a salire con limite', () => {
    const amrap = timerPlan(block('AMRAP 12'))!;
    expect(timerState(amrap, at(10 + 60))).toMatchObject({ phase: 'lavoro', left: 660 });
    expect(timerState(amrap, at(10 + 720)).phase).toBe('fine');
    const ft = timerPlan(block('For Time cap 15'))!;
    expect(ft).toMatchObject({ countUp: true, capSec: 900 });
    expect(timerState(ft, at(10 + 95))).toMatchObject({ phase: 'lavoro', elapsed: 95, left: 805 });
    expect(timerState(ft, at(10 + 900))).toMatchObject({ phase: 'fine', elapsed: 900 });
    const open = timerPlan(block('5 RFT'))!;
    expect(timerState(open, at(10 + 3600))).toMatchObject({ phase: 'lavoro', elapsed: 3600 });
    expect(timerState(open, at(10 + 3600)).left).toBeUndefined();
  });

  it('niente timer per circuiti e superserie; orologio leggibile', () => {
    expect(timerPlan(block('Circuito x3'))).toBeNull();
    expect(timerPlan(block('Superserie'))).toBeNull();
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
