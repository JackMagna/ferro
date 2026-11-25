import { useState } from 'react';
import { ChevronDown, Link2 } from '../ui/icons';
import type { LibraryExercise } from '../../lib/exerciseLibrary';
import { ExerciseMedia } from '../exercise/ExerciseMedia';
import { ExerciseInfo } from '../exercise/ExerciseInfo';
import { MuscleMap } from '../exercise/MuscleMap';
import { LinkPicker } from '../exercise/LinkPicker';
import { Sheet } from '../ui/Sheet';
import { t } from '../../lib/i18n';

interface Props {
  exercise?: LibraryExercise;
  name: string;
  collapsible: boolean;
  /** cambia l'esercizio della libreria collegato (undefined = nessuno) */
  onLink?: (libraryId: string | undefined) => void;
}

/** Foto e muscoli dell'esercizio. Su telefono è compresso sotto i comandi. */
export function ExerciseAside({ exercise, name, collapsible, onLink }: Props) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [fixing, setFixing] = useState(false);

  const body = (
    <div className="space-y-4">
      <ExerciseMedia exercise={exercise} />
      {exercise && (
        <>
          <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} compact />
          <button type="button" onClick={() => setDetails(true)} className="text-[15px] font-medium text-plate hover:underline">
            {t('Istruzioni e dettagli')}
          </button>
        </>
      )}
      {!exercise && <p className="text-sm text-muted">{t('Nessuna foto collegata a questo esercizio.')}</p>}
      {onLink && (
        <button type="button" onClick={() => setFixing(true)} className="flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-plate hover:underline">
          <Link2 className="h-4 w-4" />
          {exercise ? t('Foto sbagliata? Correggi') : t('Scegli la foto')}
        </button>
      )}
      <Sheet open={details && !!exercise} onClose={() => setDetails(false)} title={name} size="lg">
        {exercise && <ExerciseInfo exercise={exercise} displayName={name} showMedia={false} />}
      </Sheet>
      {onLink && <LinkPicker open={fixing} onClose={() => setFixing(false)} name={name} currentId={exercise?.id} onPick={onLink} />}
    </div>
  );

  if (!collapsible) return <aside aria-label={t('Come si esegue')}>{body}</aside>;

  return (
    <aside aria-label={t('Come si esegue')} className="card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span>
          <span className="block font-display text-lg font-semibold">{t('Come si esegue')}</span>
          <span className="block text-sm text-muted">{exercise ? exercise.name : t('Nessun esercizio collegato')}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{body}</div>}
    </aside>
  );
}
