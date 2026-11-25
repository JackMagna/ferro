import { useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { WorkoutProgram } from '../types';
import { applyCommunityLinks, communityChoice, linkKey } from '../lib/exerciseLinks';
import { linkVotes } from '../services/exerciseLinks';
import { t } from '../lib/i18n';

/**
 * Usa le correzioni degli altri utenti: per gli esercizi non collegati a mano legge i voti
 * (in cache per qualche giorno) e, se almeno due persone concordano, aggiorna il collegamento.
 * Gira una volta per scheda caricata, solo con un account.
 */
export function useCommunityLinks({ user, ready, program, onSaveProgram, notify }: {
  user: User | null;
  ready: boolean;
  program: WorkoutProgram;
  onSaveProgram: (p: WorkoutProgram) => void;
  notify: (msg: string) => void;
}) {
  const names = [...new Set(program.days.flatMap((d) => d.exercises).filter((e) => e.linkedBy !== 'utente').map((e) => e.name))];
  const signature = names.map(linkKey).sort().join('|');
  const done = useRef('');
  const latest = useRef(program);
  latest.current = program;

  useEffect(() => {
    if (!user || !ready || !signature || done.current === `${user.uid}:${signature}`) return;
    done.current = `${user.uid}:${signature}`;
    let alive = true;
    void (async () => {
      const choices = new Map<string, string>();
      for (const name of names) {
        const tally = await linkVotes(name);
        if (!tally) continue;
        const choice = communityChoice(tally);
        if (choice !== undefined) choices.set(linkKey(name), choice);
      }
      if (!alive || !choices.size) return;
      const result = applyCommunityLinks(latest.current, choices);
      if (!result) return;
      onSaveProgram(result.program);
      notify(result.changed === 1 ? t('Foto aggiornate su 1 esercizio grazie alle correzioni di altri utenti') : t('Foto aggiornate su {n} esercizi grazie alle correzioni di altri utenti', { n: result.changed }));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready, signature]);
}
