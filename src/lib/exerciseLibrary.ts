/**
 * Libreria esercizi pubblica: free-exercise-db (https://github.com/yuhonas/free-exercise-db),
 * rilasciata in dominio pubblico (Unlicense). I dati sono copiati in public/data/exercises.json
 * (vedi scripts/update-exercises.mjs); le immagini arrivano da jsDelivr, fissate a un commit.
 */
import { t } from './i18n';
export const LIBRARY_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const IMAGE_BASES = [
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${LIBRARY_COMMIT}/exercises/`,
  // ripiego se il CDN non risponde
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${LIBRARY_COMMIT}/exercises/`
];

export type LibraryMuscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest' | 'forearms'
  | 'glutes' | 'hamstrings' | 'lats' | 'lower back' | 'middle back' | 'neck' | 'quadriceps'
  | 'shoulders' | 'traps' | 'triceps';

export interface LibraryExercise {
  id: string;
  name: string;
  force: 'push' | 'pull' | 'static' | null;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: 'compound' | 'isolation' | null;
  equipment: string | null;
  primaryMuscles: LibraryMuscle[];
  secondaryMuscles: LibraryMuscle[];
  instructions: string[];
  category: string;
  images: string[];
}

let loading: Promise<LibraryExercise[]> | null = null;

export function loadLibrary(): Promise<LibraryExercise[]> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Libreria esercizi non disponibile (${r.status})`);
        return r.json() as Promise<LibraryExercise[]>;
      })
      .catch((err) => {
        loading = null; // permette di riprovare
        throw err;
      });
  }
  return loading;
}

/** Indirizzi possibili per una foto, in ordine di preferenza */
export function imageSources(path: string): string[] {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return IMAGE_BASES.map((base) => base + encoded);
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface LibraryFilter {
  query?: string;
  muscle?: LibraryMuscle | '';
  equipment?: string;
  category?: string;
}

export function filterLibrary(list: LibraryExercise[], f: LibraryFilter): LibraryExercise[] {
  const words = normalize(f.query ?? '').split(' ').filter(Boolean);
  return list.filter((e) => {
    if (f.muscle && !e.primaryMuscles.includes(f.muscle)) return false;
    if (f.equipment && (e.equipment ?? 'none') !== f.equipment) return false;
    if (f.category && e.category !== f.category) return false;
    if (!words.length) return true;
    const hay = normalize(`${e.name} ${e.equipment ?? ''} ${e.primaryMuscles.join(' ')} ${e.primaryMuscles.map(muscleLabel).join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
}

/* ---------- Etichette in italiano ---------- */

export const MUSCLE_LABELS: Record<LibraryMuscle, string> = {
  abdominals: t('Addominali'),
  abductors: t('Abduttori'),
  adductors: t('Adduttori'),
  biceps: t('Bicipiti'),
  calves: t('Polpacci'),
  chest: t('Petto'),
  forearms: t('Avambracci'),
  glutes: t('Glutei'),
  hamstrings: t('Femorali'),
  lats: t('Dorsali'),
  'lower back': t('Lombari'),
  'middle back': t('Dorso centrale'),
  neck: t('Collo'),
  quadriceps: t('Quadricipiti'),
  shoulders: t('Spalle'),
  traps: t('Trapezi'),
  triceps: t('Tricipiti')
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  bands: t('Elastici'),
  barbell: t('Bilanciere'),
  'body only': t('Corpo libero'),
  cable: t('Cavi'),
  dumbbell: t('Manubri'),
  'e-z curl bar': t('Bilanciere EZ'),
  'exercise ball': t('Fitball'),
  'foam roll': t('Foam roller'),
  kettlebells: t('Kettlebell'),
  machine: t('Macchina'),
  'medicine ball': t('Palla medica'),
  other: t('Altro'),
  none: t('Nessuna attrezzatura')
};

export const CATEGORY_LABELS: Record<string, string> = {
  strength: t('Forza'),
  stretching: t('Stretching'),
  cardio: t('Cardio'),
  plyometrics: t('Pliometria'),
  powerlifting: t('Powerlifting'),
  'olympic weightlifting': t('Pesistica olimpica'),
  strongman: t('Strongman')
};

export const LEVEL_LABELS: Record<LibraryExercise['level'], string> = {
  beginner: t('Principiante'),
  intermediate: t('Intermedio'),
  expert: t('Esperto')
};

export function muscleLabel(m: string): string {
  return MUSCLE_LABELS[m as LibraryMuscle] ?? m;
}
export function equipmentLabel(e: string | null): string {
  return EQUIPMENT_LABELS[e ?? 'none'] ?? e ?? '';
}

/* ---------- Mappa muscolare (react-body-highlighter) ---------- */

export type BodyMuscle =
  | 'trapezius' | 'upper-back' | 'lower-back' | 'chest' | 'biceps' | 'triceps' | 'forearm'
  | 'back-deltoids' | 'front-deltoids' | 'abs' | 'obliques' | 'adductor' | 'abductors'
  | 'hamstring' | 'quadriceps' | 'calves' | 'gluteal' | 'neck';

export const BODY_MAP: Record<LibraryMuscle, BodyMuscle[]> = {
  abdominals: ['abs', 'obliques'],
  abductors: ['abductors'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps']
};

export function toBodyMuscles(list: LibraryMuscle[]): BodyMuscle[] {
  return [...new Set(list.flatMap((m) => BODY_MAP[m] ?? []))];
}

/** Ricerca su YouTube come risorsa esterna facoltativa */
export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} esecuzione corretta`)}`;
}
