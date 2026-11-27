/**
 * Animazioni 3D degli esercizi (mini video in loop) e disegni della posizione di partenza.
 * Vengono dalla libreria aperta ferro-esercizi (licenza CC BY-SA 4.0): i file sono in public/animations/,
 * l'elenco in src/data/animations.json, entrambi aggiornati con scripts/update-animations.mjs.
 */
import data from '../data/animations.json';

export interface ExerciseAnimation {
  /** id della scheda di ferro-esercizi */
  id: string;
  webm: string;
  mp4: string;
  poster: string;
  /** disegno della posizione di partenza, con i numeri delle regolazioni della scheda */
  setup: string;
}

export const ANIMATIONS_LICENSE = data.license;

const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';

function files(id: string): ExerciseAnimation {
  const p = `${base}animations/${id}`;
  return { id, webm: `${p}.webm`, mp4: `${p}.mp4`, poster: `${p}.poster.webp`, setup: `${p}.setup.webp` };
}

/** Animazione per una scheda (id di ferro-esercizi). */
export function animationForGuide(guideId: string): ExerciseAnimation | undefined {
  return data.items.some((i) => i.id === guideId) ? files(guideId) : undefined;
}

/** Animazione per un esercizio di free-exercise-db. */
export function animationForLibrary(libraryId: string | undefined): ExerciseAnimation | undefined {
  if (!libraryId) return undefined;
  const item = data.items.find((i) => i.libraryIds.includes(libraryId));
  return item ? files(item.id) : undefined;
}

export const animationIds = (): string[] => data.items.map((i) => i.id);
