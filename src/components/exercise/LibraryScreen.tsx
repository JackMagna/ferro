import { useState } from 'react';
import type { LibraryExercise } from '../../lib/exerciseLibrary';
import { LibraryBrowser } from './LibraryBrowser';
import { ExerciseInfo } from './ExerciseInfo';
import { Sheet } from '../ui/Sheet';
import { t } from '../../lib/i18n';

export function LibraryScreen() {
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold">{t('Esercizi')}</h1>
        <p className="mt-1 max-w-prose text-[15px] text-muted">
          {t('Oltre 800 esercizi con foto e muscoli coinvolti, dalla libreria pubblica free-exercise-db.')}
        </p>
      </header>
      <LibraryBrowser onSelect={setSelected} />
      <p className="pt-4 text-sm text-faint">
        {t('Dati e immagini:')}{' '}
        <a className="underline" href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer">free-exercise-db</a>{' '}
        ({t('dominio pubblico')}). {t('Mappa muscolare:')}{' '}
        <a className="underline" href="https://github.com/giavinh79/react-body-highlighter" target="_blank" rel="noopener noreferrer">react-body-highlighter</a>{' '}
        (MIT).
      </p>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} size="lg">
        {selected && <ExerciseInfo exercise={selected} />}
      </Sheet>
    </div>
  );
}
