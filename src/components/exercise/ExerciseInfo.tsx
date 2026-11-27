import { useEffect, useState } from 'react';
import { ExternalLink } from '../ui/icons';
import {
  CATEGORY_LABELS, LEVEL_LABELS, equipmentLabel, youtubeSearchUrl, type LibraryExercise
} from '../../lib/exerciseLibrary';
import { guideFor, guidesAvailable, loadGuides, type ResolvedGuide } from '../../lib/exerciseGuides';
import { ExerciseMedia } from './ExerciseMedia';
import { GuideSections } from './GuideSections';
import { animationForGuide } from '../../lib/exerciseAnimations';
import { MuscleMap } from './MuscleMap';
import { t } from '../../lib/i18n';

/** Scheda in italiano dell'esercizio, se c'è (si carica a parte). */
function useGuide(libraryId: string): ResolvedGuide | undefined {
  const [resolved, setResolved] = useState<{ id: string; guide?: ResolvedGuide }>();
  useEffect(() => {
    if (!guidesAvailable) return;
    let alive = true;
    loadGuides()
      .then((book) => { if (alive) setResolved({ id: libraryId, guide: guideFor(book, libraryId) }); })
      .catch(() => { if (alive) setResolved({ id: libraryId }); });
    return () => { alive = false; };
  }, [libraryId]);
  return resolved?.id === libraryId ? resolved.guide : undefined;
}

/** Dettaglio di un esercizio della libreria: foto, muscoli, scheda da coach o istruzioni originali. */
export function ExerciseInfo({ exercise, displayName, showMedia = true }: { exercise: LibraryExercise; displayName?: string; showMedia?: boolean }) {
  const guide = useGuide(exercise.id);
  const facts = [
    equipmentLabel(exercise.equipment),
    CATEGORY_LABELS[exercise.category] ?? exercise.category,
    LEVEL_LABELS[exercise.level],
    exercise.mechanic === 'compound' ? t('Multiarticolare') : exercise.mechanic === 'isolation' ? t('Monoarticolare') : null
  ].filter(Boolean);

  const original = exercise.instructions.length > 0 && (
    <ol lang="en" className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-chalk/90">
      {exercise.instructions.map((step, i) => <li key={i}>{step}</li>)}
    </ol>
  );

  return (
    <div className="space-y-5">
      {showMedia && <ExerciseMedia exercise={exercise} />}
      <div className="flex flex-wrap gap-2">
        {facts.map((f) => (
          <span key={f} className="rounded-full border border-line px-3 py-1 text-sm text-muted">{f}</span>
        ))}
      </div>
      <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} />
      {guide ? (
        <>
          <GuideSections resolved={guide} setupImage={animationForGuide(guide.guide.id)?.setup} />
          {original && (
            <details className="text-sm text-muted">
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-chalk">{t('Istruzioni originali della libreria (inglese)')}</summary>
              {original}
            </details>
          )}
        </>
      ) : original && (
        <section>
          <h3 className="font-display text-lg font-semibold">{t('Come si esegue')}</h3>
          <p className="mb-2 text-sm text-faint">{t('Istruzioni originali della libreria, in inglese.')}</p>
          {original}
        </section>
      )}
      <a
        href={youtubeSearchUrl(displayName || exercise.name)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[15px] font-medium text-plate hover:underline"
      >
        {t('Cerca un video su YouTube')} <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
