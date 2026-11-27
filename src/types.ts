export type SectionType = 'progressione' | 'cedimento' | 'core';

export interface ProgramExercise {
  id: string;
  name: string;
  /** id dell'esercizio in free-exercise-db (es. "Leg_Press") */
  libraryId?: string;
  /** chi ha deciso il collegamento: 'utente' = scelto a mano (non si tocca più), 'comunita' = voti degli altri utenti; vuoto = automatico */
  linkedBy?: 'utente' | 'comunita';
  note?: string;
  warmupNote?: string;
  sectionType: SectionType;
  restTimeSec: number;
  /** prescrizione per settimana, chiave 1..totalWeeks (es. "3X10", "10-9-8..", "4xMAX") */
  weeks: Record<number, string>;
  /** riga (da 1) di questo esercizio nel foglio del coach, se la scheda arriva da lì */
  sheetRow?: number;
  /** 'loads': nel foglio le celle della riga sono vuote e servono a scrivere i carichi; la prescrizione sta nell'intestazione di sezione */
  cellMode?: 'loads';
  /** disciplina scelta a mano (vuoto = dal nome: «Cyclette» è bici, «Corsa» è corsa…), vedi lib/activity.ts */
  activity?: 'forza' | 'corsa' | 'bici' | 'nuoto' | 'vogatore' | 'ellittica' | 'camminata' | 'pilates' | 'mobilita' | 'altro';
  /** blocco (AMRAP, EMOM, For Time, circuito) a cui appartiene l'esercizio; vuoto = esercizio classico */
  blockId?: string;
}

export type BlockFormat = 'superset' | 'circuito' | 'amrap' | 'emom' | 'for_time' | 'intervalli' | 'gara';
/** cosa si registra alla fine del blocco */
export type ScoreKind = 'tempo' | 'giri_rip' | 'rip' | 'carico' | 'fatto';

/** Gruppo di esercizi dello stesso giorno con un formato: «AMRAP 12'», «For Time (cap 15')», «5 RFT»… */
export interface ProgramBlock {
  id: string;
  format: BlockFormat;
  title?: string;
  /** giri: «5 RFT» = 5, «Circuito x3» = 3 */
  rounds?: number;
  /** durata totale: AMRAP 12' = 720 */
  durationSec?: number;
  /** EMOM: ogni quanti secondi (60 = ogni minuto) */
  everySec?: number;
  workSec?: number;
  restSec?: number;
  timeCapSec?: number;
  score?: ScoreKind;
  /** l'intestazione com'era nel foglio */
  rawText?: string;
}

export interface ProgramDay {
  id: string;
  title: string;
  subtitle?: string;
  exercises: ProgramExercise[];
  blocks?: ProgramBlock[];
}

export interface ProgramGuidelines {
  modalitaEsecuzione: string[];
  progressione: string;
  cedimento: string;
}

/** Da dove arriva la scheda e come scriverci sopra */
export interface ProgramSource {
  /** nome della scheda (tab) nel foglio Google */
  tab: string;
  /** colonna (da 0) di ogni settimana */
  weekCols: Record<number, number>;
  /** scheda delle misure nel foglio del coach (di solito "MISURE") */
  measuresTab?: string;
  /** scrive i carichi nelle celle della settimana, accanto alla prescrizione */
  annotate: boolean;
  /** impronta dell'ultima versione del foglio importata o vista: serve ad avvisare quando il coach la cambia */
  fingerprint?: string;
}

export interface WorkoutProgram {
  title: string;
  athlete: string;
  trainer: string;
  totalWeeks: number;
  days: ProgramDay[];
  guidelines: ProgramGuidelines;
  source?: ProgramSource;
  /** data (AAAA-MM-GG) del primo giorno della settimana 1: serve ad associare date e settimane */
  startDate?: string;
  updatedAt?: string;
}

export interface SetEntry {
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  /** tempo fatto (cardio, tenute), in secondi */
  durationSec?: number;
  /** distanza fatta, in metri */
  distanceM?: number;
}

/** Risultato di un blocco: tempo del For Time, giri + ripetizioni dell'AMRAP, RX o Scaled. */
export interface BlockResult {
  blockId: string;
  title: string;
  kind: ScoreKind;
  timeSec?: number;
  rounds?: number;
  reps?: number;
  rx?: boolean;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  startedAt: number;
  endedAt: number;
  dayId: string;
  dayTitle: string;
  weekNumber: number;
  durationMinutes: number;
  totalVolumeKg: number;
  sets: SetEntry[];
  blockResults?: BlockResult[];
  avgBpm?: number;
  maxBpm?: number;
  sheetsSynced?: boolean;
  /** false = da registrare su Google Health; true = registrato */
  healthSynced?: boolean;
  healthLogId?: string;
  /** true = già in Health Connect (segno separato da Google Health, dalla v2.5.2) */
  hcSynced?: boolean;
}

export interface Measurement {
  id: string;
  date: string;
  /** settimana del programma (1..n): è la colonna del foglio del coach */
  week?: number;
  weightKg?: number;
  bodyFat?: number;
  chestCm?: number;
  waistCm?: number;
  abdomenCm?: number;
  hipsCm?: number;
  armsCm?: number;
  thighsCm?: number;
  notes?: string;
  sheetsSynced?: boolean;
  /** false = da inviare alla fonte dati salute scelta */
  healthSynced?: boolean;
  /** true = già in Health Connect (dalla v2.5.2) */
  hcSynced?: boolean;
  /** da dove arriva: Foglio, Google Health, Health Connect (vuoto = inserita nell'app) */
  source?: string;
}

/** Stato di una serie durante l'allenamento */
export interface SetLog {
  weightKg: number;
  reps: number;
  completed: boolean;
  durationSec?: number;
  distanceM?: number;
}

/* ---------- Alimentazione ---------- */
export type MealType = 'colazione' | 'spuntino-mattina' | 'pranzo' | 'spuntino-pomeriggio' | 'cena' | 'altro';

/** Un cibo o un pasto mangiato, con le sue calorie. */
export interface FoodEntry {
  id: string;
  /** AAAA-MM-GG */
  date: string;
  mealType: MealType;
  name: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
  /** pasto del piano da cui deriva (se l'hai segnato come "mangiato da piano") */
  planMealId?: string;
  /** ora in cui hai mangiato (ms); se manca vale l'orario predefinito del tipo di pasto */
  eatenAt?: number;
  fiberG?: number;
  sugarG?: number;
  saltG?: number;
  /** codice a barre del prodotto (EAN/UPC), se scansionato o cercato */
  barcode?: string;
  nutriScore?: 'a' | 'b' | 'c' | 'd' | 'e';
  /** gruppo NOVA 1-4 (grado di trasformazione) */
  nova?: 1 | 2 | 3 | 4;
  source?: 'manuale' | 'piano' | 'openfoodfacts' | 'tabella';
  /** false = da inviare a Google Health o Health Connect; true = inviato */
  healthSynced?: boolean;
  /** nome del data point creato in Google Health, serve per modificarlo o eliminarlo; "hc" = già scritto in Health Connect */
  healthLogId?: string;
}

/** Un alimento di un pasto salvato: i valori già calcolati per la quantità. */
export type SavedFood = Pick<FoodEntry, 'name' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'sugarG' | 'saltG'>;

/** Pasto ricorrente (es. «colazione solita»), da aggiungere con un tocco. */
export interface SavedMeal {
  id: string;
  name: string;
  mealType: MealType;
  items: SavedFood[];
}

/** Acqua bevuta: millilitri per giorno (AAAA-MM-GG). */
export type WaterLog = Record<string, number>;

export interface PlanMeal {
  id: string;
  type: MealType;
  /** gli alimenti come li ha scritti la nutrizionista */
  description: string;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

export interface DietDay {
  id: string;
  title: string;
  /** giorni della settimana a cui vale (0 = lunedì … 6 = domenica); vuoto = ogni giorno */
  weekdays: number[];
  /** true = giorno di allenamento, false = giorno di riposo, assente = vale sempre */
  training?: boolean;
  meals: PlanMeal[];
}

/** La dieta da seguire, come da nutrizionista. */
export interface DietPlan {
  title: string;
  nutritionist?: string;
  startDate?: string;
  endDate?: string;
  kcalTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** acqua da bere al giorno, in millilitri */
  waterMl?: number;
  notes?: string;
  days: DietDay[];
  updatedAt?: string;
}
