import type { LibraryExercise } from './exerciseLibrary';
import { normalize } from './exerciseLibrary';

/**
 * Collegamento tra l'esercizio scritto nella scheda (italiano, come lo scrive il coach) e la libreria
 * pubblica (inglese): serve solo per foto, muscoli e istruzioni. Serie, carichi e foglio non dipendono da qui.
 *
 * 1. Tabella di espressioni da palestra italiane → esercizio della libreria. Vince l'espressione più
 *    lunga contenuta nel nome; a parità, quella che compare prima nel nome (di solito il movimento).
 * 2. Se nessuna espressione combacia: traduzione parola per parola, accettata solo se tutte le parole
 *    importanti si ritrovano nel nome inglese.
 * 3. Altrimenti nessun collegamento: meglio nessuna foto che la foto sbagliata. L'utente sceglie tra le proposte.
 */

/** Parole che non dicono niente sull'esercizio. */
const NOISE = new Set([
  'di', 'del', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'a', 'ad', 'e', 'ed',
  'su', 'sul', 'sulla', 'sulle', 'sui', 'in', 'nel', 'nella', 'da', 'dal', 'dalla', 'con', 'col', 'per', 'tra', 'fra',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'presa', 'gradi', 'esercizio'
]);

/** Radice semplice, uguale per italiano e inglese: toglie la "s" del plurale inglese e le vocali finali italiane. */
export function stem(w: string): string {
  let s = w;
  if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  if (s.length > 4) s = s.replace(/[aeiou]+$/, '');
  return s;
}

/** Parole utili del nome, nell'ordine in cui compaiono. */
export function nameTokens(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((w) => w && !NOISE.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

/* ---------- 1. Tabella delle espressioni italiane ---------- */
type Alias = [phrase: string, id: string, not?: string];
const ALIASES: Alias[] = [
  // petto
  ['panca piana', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['panca piana bilanciere', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['panca piana manubri', 'Dumbbell_Bench_Press'],
  ['distensioni manubri', 'Dumbbell_Bench_Press'],
  ['panca inclinata', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['panca inclinata manubri', 'Incline_Dumbbell_Press'],
  ['panca declinata', 'Decline_Barbell_Bench_Press'],
  ['panca declinata manubri', 'Decline_Dumbbell_Bench_Press'],
  ['panca stretta', 'Close-Grip_Barbell_Bench_Press'],
  ['panca smith', 'Smith_Machine_Bench_Press'],
  ['chest press', 'Leverage_Chest_Press'],
  ['chest press inclinata', 'Leverage_Incline_Chest_Press'],
  ['pectoral machine', 'Butterfly'],
  ['pectoral', 'Butterfly'],
  ['peck deck', 'Butterfly'],
  ['pec deck', 'Butterfly'],
  ['butterfly', 'Butterfly'],
  ['croci', 'Dumbbell_Flyes'],
  ['croci manubri', 'Dumbbell_Flyes'],
  ['croci inclinata', 'Incline_Dumbbell_Flyes'],
  ['croci declinata', 'Decline_Dumbbell_Flyes'],
  ['croci cavi', 'Cable_Crossover'],
  ['croci cavo', 'Cable_Crossover'],
  ['croci cavi bassi', 'Low_Cable_Crossover'],
  ['croci panca cavi', 'Flat_Bench_Cable_Flyes'],
  ['crossover', 'Cable_Crossover'],
  ['croci inverse', 'Reverse_Flyes'],
  ['croci inverse macchina', 'Reverse_Machine_Flyes'],
  ['croci posteriori', 'Reverse_Machine_Flyes'],
  ['reverse fly', 'Reverse_Machine_Flyes'],
  ['dips', 'Parallel_Bar_Dip'],
  ['parallele', 'Parallel_Bar_Dip'],
  ['dips panca', 'Bench_Dips'],
  ['dips tricipiti', 'Dips_-_Triceps_Version'],
  ['dips petto', 'Dips_-_Chest_Version'],
  ['piegamenti', 'Pushups'],
  ['flessioni', 'Pushups'],
  ['push up', 'Pushups'],
  ['pushup', 'Pushups'],
  // schiena
  ['lat machine', 'Wide-Grip_Lat_Pulldown'],
  ['lat machine stretta', 'Close-Grip_Front_Lat_Pulldown'],
  ['lat machine triangolo', 'Close-Grip_Front_Lat_Pulldown'],
  ['lat machine inversa', 'Underhand_Cable_Pulldowns'],
  ['lat machine supina', 'Underhand_Cable_Pulldowns'],
  ['lat machine dietro', 'Wide-Grip_Pulldown_Behind_The_Neck'],
  ['lat pulldown', 'Wide-Grip_Lat_Pulldown'],
  ['pull down', 'Wide-Grip_Lat_Pulldown'],
  ['pulldown', 'Wide-Grip_Lat_Pulldown'],
  ['trazioni', 'Pullups'],
  ['trazioni sbarra', 'Pullups'],
  ['trazioni supina', 'Chin-Up'],
  ['trazioni inversa', 'Chin-Up'],
  ['trazioni pull down', 'Wide-Grip_Lat_Pulldown'],
  ['trazioni lat', 'Wide-Grip_Lat_Pulldown'],
  ['pull up', 'Pullups'],
  ['pullup', 'Pullups'],
  ['chin up', 'Chin-Up'],
  ['rematore', 'Bent_Over_Barbell_Row'],
  ['rematore bilanciere', 'Bent_Over_Barbell_Row'],
  ['rematore manubrio', 'One-Arm_Dumbbell_Row'],
  ['rematore panca inclinata', 'Dumbbell_Incline_Row'],
  ['rematore pulley', 'Seated_Cable_Rows'],
  ['rematore cavi', 'Seated_Cable_Rows'],
  ['rematore cavo', 'Seated_Cable_Rows'],
  ['rematore seduto', 'Seated_Cable_Rows'],
  ['rematore smith', 'Smith_Machine_Bent_Over_Row'],
  ['pulley', 'Seated_Cable_Rows'],
  ['pulley basso', 'Seated_Cable_Rows'],
  ['pullover', 'Bent-Arm_Dumbbell_Pullover'],
  ['pullover cavi', 'Straight-Arm_Pulldown'],
  ['pulldown braccia tese', 'Straight-Arm_Pulldown'],
  ['stacco', 'Barbell_Deadlift'],
  ['stacchi', 'Barbell_Deadlift'],
  ['stacco terra', 'Barbell_Deadlift'],
  ['stacco rumeno', 'Romanian_Deadlift'],
  ['stacco gambe tese', 'Stiff-Legged_Barbell_Deadlift'],
  ['stacco sumo', 'Sumo_Deadlift'],
  ['deadlift', 'Barbell_Deadlift'],
  ['romanian deadlift', 'Romanian_Deadlift'],
  ['sumo deadlift', 'Sumo_Deadlift'],
  ['good morning', 'Good_Morning'],
  ['hyperextension', 'Hyperextensions_Back_Extensions'],
  ['hiperextension', 'Hyperextensions_Back_Extensions'],
  ['iperestensioni', 'Hyperextensions_Back_Extensions'],
  ['back extension', 'Hyperextensions_Back_Extensions'],
  // spalle
  ['military press', 'Standing_Military_Press'],
  ['lento', 'Standing_Military_Press'],
  ['lento avanti', 'Standing_Military_Press'],
  ['lento dietro', 'Barbell_Shoulder_Press'],
  ['lento manubri', 'Seated_Dumbbell_Press'],
  ['lento avanti manubri', 'Dumbbell_Shoulder_Press'],
  ['shoulder press', 'Dumbbell_Shoulder_Press'],
  ['shoulder press macchina', 'Machine_Shoulder_Military_Press'],
  ['shoulder press machine', 'Machine_Shoulder_Military_Press'],
  ['arnold press', 'Arnold_Dumbbell_Press'],
  ['alzate laterali', 'Side_Lateral_Raise'],
  ['alzate laterali sedute', 'Seated_Side_Lateral_Raise'],
  ['alzate laterali cavi', 'Cable_Seated_Lateral_Raise'],
  ['alzate laterali cavo', 'Cable_Seated_Lateral_Raise'],
  ['alzate frontali', 'Front_Dumbbell_Raise'],
  ['alzate frontali cavi', 'Front_Cable_Raise'],
  ['alzate frontali bilanciere', 'Standing_Front_Barbell_Raise_Over_Head'],
  ['alzate posteriori', 'Seated_Bent-Over_Rear_Delt_Raise'],
  ['alzate busto flesso', 'Seated_Bent-Over_Rear_Delt_Raise'],
  ['alzate prono', 'Lying_Rear_Delt_Raise'],
  ['alzate laterali prono', 'Lying_Rear_Delt_Raise'],
  ['face pull', 'Face_Pull'],
  ['tirate', 'Upright_Barbell_Row'],
  ['tirate mento', 'Upright_Barbell_Row'],
  ['upright row', 'Upright_Barbell_Row'],
  ['scrollate', 'Barbell_Shrug'],
  ['scrollate manubri', 'Dumbbell_Shrug'],
  ['shrug', 'Barbell_Shrug'],
  // braccia
  ['curl', 'Barbell_Curl'],
  ['curl bilanciere', 'Barbell_Curl'],
  ['curl ez', 'EZ-Bar_Curl'],
  ['curl manubri', 'Dumbbell_Bicep_Curl'],
  ['curl alternato', 'Dumbbell_Alternate_Bicep_Curl'],
  ['curl manubri alternato', 'Dumbbell_Alternate_Bicep_Curl'],
  ['curl martello', 'Hammer_Curls'],
  ['hammer curl', 'Hammer_Curls'],
  ['curl martello cavi', 'Cable_Hammer_Curls_-_Rope_Attachment'],
  ['curl corda', 'Cable_Hammer_Curls_-_Rope_Attachment'],
  ['curl cavi', 'Standing_Biceps_Cable_Curl'],
  ['curl cavo', 'Standing_Biceps_Cable_Curl'],
  ['curl scott', 'Preacher_Curl'],
  ['panca scott', 'Preacher_Curl'],
  ['curl panca scott', 'Preacher_Curl'],
  ['preacher curl', 'Preacher_Curl'],
  ['curl panca inclinata', 'Incline_Dumbbell_Curl'],
  ['curl manubri panca', 'Incline_Dumbbell_Curl'],
  ['curl inclinato', 'Incline_Dumbbell_Curl'],
  ['curl concentrato', 'Concentration_Curls'],
  ['curl macchina', 'Machine_Bicep_Curl'],
  ['french press', 'EZ-Bar_Skullcrusher'],
  ['french press manubri', 'Lying_Dumbbell_Tricep_Extension'],
  ['skull crusher', 'EZ-Bar_Skullcrusher'],
  ['push down', 'Triceps_Pushdown'],
  ['pushdown', 'Triceps_Pushdown'],
  ['push down corda', 'Triceps_Pushdown_-_Rope_Attachment'],
  ['push down inverso', 'Reverse_Grip_Triceps_Pushdown'],
  ['push down inversa', 'Reverse_Grip_Triceps_Pushdown'],
  ['estensioni tricipiti', 'Standing_Dumbbell_Triceps_Extension'],
  ['estensioni sopra testa', 'Standing_Dumbbell_Triceps_Extension'],
  ['estensioni cavi', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['estensioni corda', 'Cable_Rope_Overhead_Triceps_Extension'],
  ['kickback', 'Tricep_Dumbbell_Kickback'],
  ['kick back', 'Tricep_Dumbbell_Kickback'],
  // gambe
  ['squat', 'Barbell_Squat'],
  ['squat bilanciere', 'Barbell_Squat'],
  ['squat manubri', 'Dumbbell_Squat'],
  ['front squat', 'Front_Barbell_Squat'],
  ['squat frontale', 'Front_Barbell_Squat'],
  ['squat bulgaro', 'Split_Squat_with_Dumbbells'],
  ['split squat', 'Split_Squat_with_Dumbbells'],
  ['goblet squat', 'Goblet_Squat'],
  ['hack squat', 'Hack_Squat'],
  ['squat smith', 'Smith_Machine_Squat'],
  ['smith squat', 'Smith_Machine_Squat'],
  ['pressa', 'Leg_Press'],
  ['leg press', 'Leg_Press'],
  ['pressa polpacci', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['polpacci pressa', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['calf pressa', 'Calf_Press_On_The_Leg_Press_Machine'],
  ['affondi', 'Dumbbell_Lunges'],
  ['affondi manubri', 'Dumbbell_Lunges'],
  ['affondi bilanciere', 'Barbell_Lunge'],
  ['affondi camminati', 'Bodyweight_Walking_Lunge'],
  ['affondi camminata', 'Bodyweight_Walking_Lunge'],
  ['affondi camminati bilanciere', 'Barbell_Walking_Lunge'],
  ['affondi indietro', 'Dumbbell_Rear_Lunge'],
  ['walking lunge', 'Bodyweight_Walking_Lunge'],
  ['leg extension', 'Leg_Extensions'],
  ['leg curl', 'Lying_Leg_Curls'],
  ['leg curl sdraiato', 'Lying_Leg_Curls'],
  ['leg curl prono', 'Lying_Leg_Curls'],
  ['leg curl seduto', 'Seated_Leg_Curl'],
  ['hip thrust', 'Barbell_Hip_Thrust'],
  ['glute bridge', 'Barbell_Glute_Bridge'],
  ['ponte glutei', 'Barbell_Glute_Bridge'],
  ['abductor', 'Thigh_Abductor'],
  ['abduttori', 'Thigh_Abductor'],
  ['abduzioni', 'Thigh_Abductor'],
  ['adductor', 'Thigh_Adductor'],
  ['adduttori', 'Thigh_Adductor'],
  ['adduzioni', 'Thigh_Adductor', 'scapolare'],
  ['calf', 'Standing_Calf_Raises'],
  ['calf raise', 'Standing_Calf_Raises'],
  ['polpacci', 'Standing_Calf_Raises'],
  ['calf seduto', 'Seated_Calf_Raise'],
  ['polpacci seduto', 'Seated_Calf_Raise'],
  ['step up', 'Dumbbell_Step_Ups'],
  // addome
  ['crunch', 'Crunches'],
  ['crunch cavi', 'Cable_Crunch'],
  ['crunch cavo', 'Cable_Crunch'],
  ['crunch macchina', 'Ab_Crunch_Machine'],
  ['crunch declinata', 'Decline_Crunch'],
  ['crunch declinato', 'Decline_Crunch'],
  ['crunch obliqui', 'Oblique_Crunches'],
  ['reverse crunch', 'Reverse_Crunch'],
  ['revers crunch', 'Reverse_Crunch'],
  ['crunch inverso', 'Reverse_Crunch'],
  ['reverse crunch declinata', 'Decline_Reverse_Crunch'],
  ['revers crunch declinata', 'Decline_Reverse_Crunch'],
  ['plank', 'Plank'],
  ['plank laterale', 'Side_Bridge'],
  ['side plank', 'Side_Bridge'],
  ['sollevamento gambe', 'Hanging_Leg_Raise'],
  ['leg raise', 'Hanging_Leg_Raise'],
  ['sollevamento gambe panca', 'Flat_Bench_Lying_Leg_Raise'],
  ['ab wheel', 'Ab_Roller'],
  ['ruota addominali', 'Ab_Roller'],
  ['russian twist', 'Russian_Twist'],
  ['mountain climber', 'Mountain_Climbers'],
  ['kettlebell swing', 'One-Arm_Kettlebell_Swings'],
  ['swing', 'One-Arm_Kettlebell_Swings']
];

const ALIAS_TOKENS = ALIASES.map(([phrase, id, not]) => ({ tokens: nameTokens(phrase), id, not: not ? nameTokens(not) : [] }));
/** Per i test: tutti gli esercizi a cui punta la tabella. */
export const ALIAS_IDS = [...new Set(ALIASES.map(([, id]) => id))];

function aliasMatch(tokens: string[]): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const a of ALIAS_TOKENS) {
    if (!a.tokens.length || !a.tokens.every((t) => tokens.includes(t)) || a.not.some((t) => tokens.includes(t))) continue;
    // più parole = più specifica; a parità conta chi compare prima nel nome (il movimento sta in testa)
    const score = a.tokens.length * 10 - tokens.indexOf(a.tokens[0]) * 6;
    if (!best || score > best.score) best = { id: a.id, score };
  }
  return best?.id;
}

/* ---------- 2. Traduzione parola per parola ---------- */
const IT_EN: Record<string, string[]> = {
  petto: ['chest'], panca: ['bench'], piana: [], inclinata: ['incline'], inclinato: ['incline'], declinata: ['decline'], declinato: ['decline'],
  manubri: ['dumbbell'], manubrio: ['dumbbell'], bilanciere: ['barbell'], cavi: ['cable'], cavo: ['cable'], corda: ['rope'], sbarra: ['bar'],
  macchina: ['machine'], seduto: ['seated'], seduta: ['seated'], sedute: ['seated'], piedi: ['standing'], sdraiato: ['lying'], prono: ['lying'],
  stretta: ['close', 'grip'], larga: ['wide', 'grip'], inversa: ['reverse', 'grip'], supina: ['underhand'], alternato: ['alternate'],
  rematore: ['row'], trazioni: ['pullup'], spinte: ['press'], distensioni: ['press'], croci: ['fly'], alzate: ['raise'],
  laterali: ['lateral'], frontali: ['front'], posteriori: ['rear'], estensioni: ['extension'], tricipiti: ['triceps'], bicipiti: ['biceps'],
  polpacci: ['calf'], glutei: ['glute'], affondi: ['lunge'], stacco: ['deadlift'], stacchi: ['deadlift'], rumeno: ['romanian'],
  martello: ['hammer'], concentrato: ['concentration'], scrollate: ['shrug'], addominali: ['ab'], obliqui: ['oblique'], gambe: ['leg'],
  parallele: ['dip'], iperestensioni: ['hyperextension'], revers: ['reverse'], singolo: ['one', 'arm'], singola: ['one', 'arm']
};
const IT_EN_STEMMED = new Map(Object.entries(IT_EN).map(([k, v]) => [stem(k), v.map(stem)]));
/** Varianti particolari: un esercizio che le ha non va bene se il nome in scheda non le nomina. */
const VARIANT = new Set(['revers', 'single', 'one', 'alternat', 'smith', 'weight', 'band', 'ball', 'suspend', 'upright', 'rear', 'lying', 'guillotin', 'kettlebell', 'chain', 'decline', 'incline', 'close', 'wide', 'leverag', 'machin'].map(stem));

function englishTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) out.push(...(IT_EN_STEMMED.get(t) ?? [t]));
  return [...new Set(out)];
}

interface Scored { id: string; score: number; hit: number; extra: number; variants: number }

function scoreAll(want: string[], library: LibraryExercise[]): Scored[] {
  const out: Scored[] = [];
  for (const e of library) {
    const words = new Set(nameTokens(e.name));
    const hit = want.filter((t) => words.has(t)).length;
    if (!hit) continue;
    const extra = [...words].filter((w) => !want.includes(w)).length;
    const variants = [...words].filter((w) => VARIANT.has(w) && !want.includes(w)).length;
    out.push({ id: e.id, score: hit * 10 - extra * 2 - variants * 6, hit, extra, variants });
  }
  return out.sort((a, b) => b.score - a.score || a.extra - b.extra || a.id.localeCompare(b.id));
}

/* ---------- API ---------- */
export interface ExerciseMatch {
  /** collegamento sicuro, oppure undefined */
  id?: string;
  how?: 'tabella' | 'parole';
  /** fino a 3 proposte da mostrare quando non c'è un collegamento sicuro (o per cambiarlo) */
  suggestions: string[];
}

export function matchExercise(name: string, library: LibraryExercise[]): ExerciseMatch {
  const tokens = nameTokens(name);
  if (!tokens.length) return { suggestions: [] };
  const known = new Set(library.map((e) => e.id));
  const want = englishTokens(tokens);
  const ranked = scoreAll(want, library);
  const fromAlias = aliasMatch(tokens);
  if (fromAlias && known.has(fromAlias)) {
    return { id: fromAlias, how: 'tabella', suggestions: [fromAlias, ...ranked.map((r) => r.id).filter((id) => id !== fromAlias)].slice(0, 3) };
  }
  const top = ranked[0];
  // sicuro solo se tutte le parole cercate (almeno due) sono nel nome inglese e non ci sono varianti estranee
  const confident = !!top && want.length >= 2 && top.hit === want.length && top.variants === 0 && (ranked[1]?.score ?? -Infinity) < top.score;
  return { id: confident ? top.id : undefined, how: confident ? 'parole' : undefined, suggestions: ranked.slice(0, 3).map((r) => r.id) };
}

/** Esercizio della libreria per il nome in scheda, solo se il collegamento è sicuro. */
export function suggestLibraryId(name: string, library: LibraryExercise[]): string | undefined {
  return matchExercise(name, library).id;
}
