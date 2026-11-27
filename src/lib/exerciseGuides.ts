/**
 * Schede di esecuzione in italiano (regolazioni, passi, errori comuni) per gli esercizi più usati.
 * I testi sono in src/data/guides/it.json (licenza CC BY 4.0, vedi il README accanto) e si caricano
 * solo quando servono, in un file a parte, così non pesano sull'avvio dell'app.
 */
import { lang } from './i18n';

export type GuideKind = 'macchina' | 'cavi' | 'pesi liberi' | 'corpo libero';

export interface GuideMistake {
  error: string;
  fix: string;
}

export interface ExerciseGuide {
  id: string;
  name: string;
  aliases: string[];
  /** id degli esercizi di free-exercise-db descritti da questa scheda */
  libraryIds: string[];
  kind: GuideKind;
  muscles: string;
  setup: string[];
  steps: string[];
  mistakes: GuideMistake[];
  /** frase breve da ricordare durante la serie */
  cue: string;
  feel: string;
  stop: string;
  /** chiavi di GuideBook.sources */
  sources: string[];
}

export interface GuideSource {
  title: string;
  url: string;
}

export interface GuideBook {
  format: 'ferro-guides-v1';
  lang: string;
  license: string;
  updated: string;
  sources: Record<string, GuideSource>;
  safety: { machine: string[]; free: string[]; general: string };
  guides: ExerciseGuide[];
}

export interface ResolvedGuide {
  guide: ExerciseGuide;
  sources: GuideSource[];
  /** avvertenze per il tipo di attrezzo (macchine o pesi liberi) */
  safety: string[];
  general: string;
  license: string;
}

/** Le schede ci sono solo in italiano: nelle altre lingue resta la descrizione della libreria. */
export const guidesAvailable = lang === 'it';

let loading: Promise<GuideBook> | null = null;

export function loadGuides(): Promise<GuideBook> {
  if (!loading) {
    loading = import('../data/guides/it.json')
      .then((m) => (m.default ?? m) as unknown as GuideBook)
      .catch((err) => {
        loading = null; // permette di riprovare
        throw err;
      });
  }
  return loading;
}

/** Scheda per un esercizio della libreria, con fonti e avvertenze già risolte. */
export function guideFor(book: GuideBook, libraryId: string): ResolvedGuide | undefined {
  const guide = book.guides.find((g) => g.libraryIds.includes(libraryId));
  if (!guide) return undefined;
  const safety = guide.kind === 'macchina' || guide.kind === 'cavi' ? book.safety.machine : guide.kind === 'pesi liberi' ? book.safety.free : [];
  return {
    guide,
    sources: guide.sources.map((k) => book.sources[k]).filter((s): s is GuideSource => !!s),
    safety,
    general: book.safety.general,
    license: book.license
  };
}
