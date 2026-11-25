import type { ProgramExercise, WorkoutProgram } from '../types';
import { nameTokens } from './exerciseMatch';

/**
 * Collegamenti condivisi tra utenti: chi corregge la foto di un esercizio lascia un voto
 * (nome in scheda → esercizio della libreria). I voti di tutti decidono il collegamento per gli altri.
 * Qui solo la logica; la lettura e la scrittura su Firestore stanno in services/exerciseLinks.ts.
 */

/** Chiave del nome, uguale per «Panca piana con bilanciere» e «panca piana bilanciere». Vuota se il nome non dice niente. */
export function linkKey(name: string): string {
  return nameTokens(name).join('-').slice(0, 120);
}

export interface LinkVote {
  /** esercizio scelto; '' = nessuno della libreria va bene */
  libraryId: string;
}

export interface LinkTally {
  libraryId: string;
  votes: number;
}

/** Voti contati per esercizio, il più votato per primo. */
export function tallyVotes(votes: LinkVote[]): LinkTally[] {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.libraryId, (counts.get(v.libraryId) ?? 0) + 1);
  return [...counts].map(([libraryId, n]) => ({ libraryId, votes: n })).sort((a, b) => b.votes - a.votes || a.libraryId.localeCompare(b.libraryId));
}

/** Voti minimi e quota di maggioranza perché la scelta degli altri valga senza chiedere. */
export const COMMUNITY_MIN_VOTES = 2;
export const COMMUNITY_MIN_SHARE = 0.6;

/**
 * Collegamento deciso dagli utenti: almeno 2 voti e il 60% dei voti.
 * undefined = nessuna decisione; '' = gli utenti dicono che nessun esercizio della libreria va bene.
 */
export function communityChoice(tally: LinkTally[]): string | undefined {
  const total = tally.reduce((s, t) => s + t.votes, 0);
  const top = tally[0];
  if (!top || top.votes < COMMUNITY_MIN_VOTES || top.votes / total < COMMUNITY_MIN_SHARE) return undefined;
  return top.libraryId;
}

/**
 * Applica le scelte degli altri utenti agli esercizi della scheda che l'utente non ha collegato a mano.
 * choices: chiave del nome → esercizio deciso ('' = nessuno). Restituisce null se non cambia niente.
 */
export function applyCommunityLinks(program: WorkoutProgram, choices: Map<string, string>): { program: WorkoutProgram; changed: number } | null {
  let changed = 0;
  const days = program.days.map((d) => ({
    ...d,
    exercises: d.exercises.map((e): ProgramExercise => {
      if (e.linkedBy === 'utente') return e;
      const choice = choices.get(linkKey(e.name));
      if (choice === undefined || (choice || undefined) === e.libraryId) return e;
      changed++;
      return { ...e, libraryId: choice || undefined, linkedBy: 'comunita' };
    })
  }));
  return changed ? { program: { ...program, days }, changed } : null;
}

/** Collegamento scelto a mano: vale per tutti gli esercizi della scheda con lo stesso nome. */
export function linkByName(program: WorkoutProgram, name: string, libraryId: string | undefined): WorkoutProgram {
  const key = linkKey(name);
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.name === name || (key && linkKey(e.name) === key) ? { ...e, libraryId, linkedBy: 'utente' as const } : e))
    }))
  };
}
