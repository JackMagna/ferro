/**
 * Timer dei blocchi (AMRAP, EMOM, For Time, Tabata e intervalli), calcolato dal tempo trascorso:
 * nessun contatore che si incrementa, così resta preciso anche se il telefono rallenta o mette in pausa la pagina.
 * Circuiti e superserie non hanno un tempo: niente timer.
 */
import type { ProgramBlock } from '../types';

export type TimerPhase = 'pronti' | 'lavoro' | 'recupero' | 'fine';

export interface TimerSegment { kind: 'lavoro' | 'recupero'; sec: number; round: number }

export interface TimerPlan {
  /** secondi di «pronti» prima del via */
  leadSec: number;
  /** a tempo fisso (AMRAP, EMOM, intervalli); vuoto se il tempo sale (For Time) */
  segments: TimerSegment[];
  rounds: number;
  /** il tempo sale fino a «Fine» o al limite (For Time, AMRAP senza durata) */
  countUp: boolean;
  capSec?: number;
  /** «Giro» o «Minuto» (EMOM ogni minuto) */
  roundLabel: string;
}

export interface TimerState {
  phase: TimerPhase;
  round: number;
  rounds: number;
  /** secondi che mancano alla fine della fase (o al limite), se c'è */
  left?: number;
  /** secondi passati dal via */
  elapsed: number;
  /** cambia a ogni fase: serve per il bip */
  index: number;
}

export const LEAD_SEC = 10;

export function timerPlan(b: ProgramBlock): TimerPlan | null {
  switch (b.format) {
    case 'amrap':
      return b.durationSec
        ? { leadSec: LEAD_SEC, segments: [{ kind: 'lavoro', sec: b.durationSec, round: 1 }], rounds: 1, countUp: false, roundLabel: 'Giro' }
        : { leadSec: LEAD_SEC, segments: [], rounds: 1, countUp: true, roundLabel: 'Giro' };
    case 'emom': {
      const every = b.everySec && b.everySec > 0 ? b.everySec : 60;
      const n = b.rounds ?? (b.durationSec ? Math.max(1, Math.round(b.durationSec / every)) : 10);
      return {
        leadSec: LEAD_SEC,
        segments: Array.from({ length: n }, (_, i) => ({ kind: 'lavoro' as const, sec: every, round: i + 1 })),
        rounds: n,
        countUp: false,
        roundLabel: every === 60 ? 'Minuto' : 'Giro'
      };
    }
    case 'intervalli': {
      const n = b.rounds ?? 8;
      const work = b.workSec ?? 20;
      const rest = b.restSec ?? 10;
      const segments: TimerSegment[] = [];
      for (let i = 1; i <= n; i++) {
        segments.push({ kind: 'lavoro', sec: work, round: i });
        if (rest > 0 && i < n) segments.push({ kind: 'recupero', sec: rest, round: i });
      }
      return { leadSec: LEAD_SEC, segments, rounds: n, countUp: false, roundLabel: 'Giro' };
    }
    case 'for_time':
    case 'gara':
      return { leadSec: LEAD_SEC, segments: [], rounds: b.rounds ?? 1, countUp: true, capSec: b.timeCapSec, roundLabel: 'Giro' };
    default:
      return null;
  }
}

/** Durata totale a tempo fisso (senza i «pronti»), o il limite per il For Time. */
export function plannedSec(p: TimerPlan): number | undefined {
  if (p.countUp) return p.capSec;
  return p.segments.reduce((t, s) => t + s.sec, 0);
}

export function timerState(p: TimerPlan, elapsedMs: number): TimerState {
  const ms = Math.max(0, elapsedMs);
  const lead = p.leadSec * 1000;
  if (ms < lead) return { phase: 'pronti', round: 1, rounds: p.rounds, left: Math.ceil((lead - ms) / 1000), elapsed: 0, index: 0 };
  const t = ms - lead;
  const elapsed = Math.floor(t / 1000);
  if (p.countUp) {
    if (p.capSec && t >= p.capSec * 1000) return { phase: 'fine', round: p.rounds, rounds: p.rounds, left: 0, elapsed: p.capSec, index: 2 };
    return { phase: 'lavoro', round: 1, rounds: p.rounds, left: p.capSec ? Math.ceil((p.capSec * 1000 - t) / 1000) : undefined, elapsed, index: 1 };
  }
  let start = 0;
  for (let i = 0; i < p.segments.length; i++) {
    const s = p.segments[i];
    const end = start + s.sec * 1000;
    if (t < end) return { phase: s.kind, round: s.round, rounds: p.rounds, left: Math.ceil((end - t) / 1000), elapsed, index: i + 1 };
    start = end;
  }
  return { phase: 'fine', round: p.rounds, rounds: p.rounds, left: 0, elapsed: Math.floor(start / 1000), index: p.segments.length + 1 };
}

export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
};
