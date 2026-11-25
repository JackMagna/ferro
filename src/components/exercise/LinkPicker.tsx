import { useEffect, useMemo, useState } from 'react';
import { Search, Unlink, Users } from '../ui/icons';
import { useLibrary } from '../../hooks/useLibrary';
import { muscleLabel, type LibraryExercise } from '../../lib/exerciseLibrary';
import { matchExercise } from '../../lib/exerciseMatch';
import type { LinkTally } from '../../lib/exerciseLinks';
import { linkVotes } from '../../services/exerciseLinks';
import { auth } from '../../services/firebase';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { SafeImg } from './SafeImg';
import { LibraryBrowser } from './LibraryBrowser';
import { t } from '../../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  /** nome dell'esercizio in scheda */
  name: string;
  currentId?: string;
  /** libraryId undefined = nessun esercizio della libreria (toglie la foto) */
  onPick: (libraryId: string | undefined) => void;
}

/**
 * Correzione rapida della foto: un tocco su una proposta. Le proposte vengono dalle scelte degli altri
 * utenti (con quante persone l'hanno scelta) e dal riconoscimento del nome; in fondo la ricerca nella libreria.
 */
export function LinkPicker({ open, onClose, name, currentId, onPick }: Props) {
  const { list, byId } = useLibrary();
  const [votes, setVotes] = useState<LinkTally[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearching(false);
    let alive = true;
    void linkVotes(name, true).then((v) => { if (alive) setVotes(v); });
    return () => { alive = false; };
  }, [open, name]);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: { exercise: LibraryExercise; votes: number }[] = [];
    const add = (id: string, n = 0) => {
      const e = byId.get(id);
      if (!e || seen.has(id)) return;
      seen.add(id);
      out.push({ exercise: e, votes: n });
    };
    votes?.forEach((v) => v.libraryId && add(v.libraryId, v.votes));
    if (list.length) matchExercise(name, list).suggestions.forEach((id) => add(id));
    return out.slice(0, 5);
  }, [votes, list, byId, name]);
  const noneVotes = votes?.find((v) => v.libraryId === '')?.votes ?? 0;
  const pick = (id: string | undefined) => { onPick(id); onClose(); };

  return (
    <>
      <Sheet open={open && !searching} onClose={onClose} title={t('Correggi la foto')} size="lg">
        <div className="space-y-3">
          <p className="text-[15px] text-muted">
            {(() => { const [pre, post] = t('Quale esercizio è «{name}»? Un tocco e la foto cambia in tutta la scheda.').split('{name}'); return <>{pre}<span className="text-chalk">{name}</span>{post}</>; })()}
          </p>
          {options.map(({ exercise: e, votes: n }) => (
            <button
              key={e.id} type="button" onClick={() => pick(e.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left ${e.id === currentId ? 'border-plate bg-plate/10' : 'border-line hover:border-faint'}`}
            >
              <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-ink"><SafeImg path={e.images[0]} alt="" className="h-full w-full bg-white object-contain" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.name}</span>
                <span className="block truncate text-sm text-muted">{e.primaryMuscles.map(muscleLabel).join(', ')}</span>
                {n > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-plate">
                    <Users className="h-3.5 w-3.5" />{n === 1 ? t('Scelto da 1 persona') : t('Scelto da {n} persone', { n })}
                  </span>
                )}
              </span>
              {e.id === currentId && <span className="shrink-0 text-sm text-plate">{t('Attuale')}</span>}
            </button>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button icon={<Search className="h-4 w-4" />} onClick={() => setSearching(true)}>{t('Cerca nella libreria')}</Button>
            <Button variant="ghost" icon={<Unlink className="h-4 w-4" />} onClick={() => pick(undefined)}>
              {t('Nessuno va bene')}{noneVotes > 0 ? ` (${noneVotes})` : ''}
            </Button>
          </div>
          <p className="text-xs text-faint">
            {auth.currentUser
              ? t("La tua scelta aiuta gli altri: viene condivisa con il nome dell'esercizio, senza il tuo nome né la tua email. Quando almeno due persone concordano, Ferro la usa anche per chi ha lo stesso esercizio.")
              : t('Con un account le tue correzioni aiutano gli altri e vedi quelle della comunità.')}
          </p>
        </div>
      </Sheet>
      <Sheet open={open && searching} onClose={() => setSearching(false)} title={t('Cerca nella libreria')} size="lg">
        <LibraryBrowser dense selectedId={currentId} onSelect={(e) => pick(e.id)} />
      </Sheet>
    </>
  );
}
