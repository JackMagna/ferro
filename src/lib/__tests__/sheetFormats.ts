/**
 * Fogli e prescrizioni di prova in formati diversi da quello del coach di oggi.
 * Tutti inventati (nomi, esercizi, numeri): il repo è pubblico.
 * Servono a misurare il lettore e a non tornare indietro quando lo si cambia.
 */
const r = (...c: string[]) => c;

/** Come i coach scrivono serie e ripetizioni, con quello che il lettore deve capire. */
export const PRESCRIPTIONS: { text: string; reps: number[]; repsMax?: number[]; extra?: Record<string, unknown> }[] = [
  { text: '3x10', reps: [10, 10, 10] },
  { text: '3 x 10', reps: [10, 10, 10] },
  { text: '3×10', reps: [10, 10, 10] },
  { text: '4x 8', reps: [8, 8, 8, 8] },
  { text: '3 serie da 10', reps: [10, 10, 10] },
  { text: '4 serie x 8 rip', reps: [8, 8, 8, 8] },
  { text: '4x8-10', reps: [8, 8, 8, 8], repsMax: [10, 10, 10, 10] },
  { text: '3x10/12', reps: [10, 10, 10], repsMax: [12, 12, 12] },
  { text: '3 serie da 8 a 12', reps: [8, 8, 8], repsMax: [12, 12, 12] },
  { text: '8-10', reps: [8, 8, 8], repsMax: [10, 10, 10] },
  { text: '10-8-6', reps: [10, 8, 6] },
  { text: '12-10', reps: [12, 10] },
  { text: '10/8/6', reps: [10, 8, 6] },
  { text: '12,10,8,6', reps: [12, 10, 8, 6] },
  { text: '5/3/1', reps: [5, 3, 1] },
  { text: '2x15 + 1xMAX', reps: [15, 15, 12] },
  { text: '3x10 + 3x8', reps: [10, 10, 10, 8, 8, 8] },
  { text: '5x5 @80%', reps: [5, 5, 5, 5, 5], extra: { percent: 80 } },
  { text: '3x10 RPE 8', reps: [10, 10, 10], extra: { rpe: 8 } },
  { text: '4x6 RIR 2', reps: [6, 6, 6, 6], extra: { rir: 2 } },
  { text: '4x10 tempo 3-0-1-0', reps: [10, 10, 10, 10], extra: { tempo: '3-0-1-0' } },
  { text: '4X8 rec 90"', reps: [8, 8, 8, 8], extra: { restSec: 90 } },
  { text: "3x10 rec 1'30\"", reps: [10, 10, 10], extra: { restSec: 90 } },
  { text: "4x8 r 2'", reps: [8, 8, 8, 8], extra: { restSec: 120 } },
  { text: '3x12 per lato', reps: [12, 12, 12], extra: { perSide: true } },
  { text: '4x6+6', reps: [6, 6, 6, 6], extra: { perSide: true } },
  { text: '3x(10+10)', reps: [10, 10, 10], extra: { dropset: true } },
  { text: '3x10 dropset', reps: [10, 10, 10], extra: { dropset: true } },
  { text: '3X8 AUMENTO PESO', reps: [8, 8, 8], extra: { increaseWeight: true } }
];

/** Testi che non sono serie e ripetizioni: il lettore non deve inventare 3×10 senza dirlo. */
export const NOT_PRESCRIPTIONS = ['a piacere', '12,5', '40/42', '3-1-1-0'];

/** Fogli in formati diversi. `today`: il lettore di oggi li legge; gli altri sono il lavoro dei prossimi passi. */
export const SHEETS: { name: string; today: boolean; rows: string[][] }[] = [
  {
    name: 'giorno con lettera e nome del gruppo', today: true,
    rows: [r('GIORNO A - PUSH', 'NOTE', '1 SETT.', '2 SETT.'), r('PANCA PIANA', '', '4x8', '4x6'), r('SPINTE MANUBRI', '', '10/8/6', '12,10,8,6')]
  },
  {
    name: 'prescrizioni scritte a parole e con la forbice', today: true,
    rows: [r('GIORNO 1', 'NOTE', 'SETTIMANA 1', 'SETTIMANA 2'), r('SQUAT', '', '3 serie da 8 a 12', '4x8-10'), r('AFFONDI', 'per gamba', '3x12 per lato', '4x6+6')]
  },
  {
    name: 'tabella classica: Esercizio, Serie, Ripetizioni, Recupero', today: false,
    rows: [r('SCHEDA A'), r('Esercizio', 'Serie', 'Ripetizioni', 'Recupero', 'Carico', 'Note'), r('Panca piana', '4', '8', '90"', '60 kg', ''), r('Lat machine', '3', '10', '60"', '', 'presa larga')]
  },
  { name: 'giorni chiamati con il giorno della settimana', today: false, rows: [r('LUNEDÌ - PETTO', 'Note', 'Sett 1', 'Sett 2'), r('Panca piana', '', '4x8', '4x6')] },
  { name: 'giorni chiamati PUSH, PULL, LEGS', today: false, rows: [r('PUSH', 'NOTE', '1 SETT.'), r('Panca', '', '4x8'), r('PULL', 'NOTE', '1 SETT.'), r('Rematore', '', '4x8')] },
  { name: 'griglia che parte dalla colonna B', today: false, rows: [r('', 'GIORNO 1', 'NOTE', '1 SETT.'), r('', 'Panca', '', '4x8')] },
  { name: 'numerazione A1/A2 con il nome in colonna B', today: false, rows: [r('GIORNO 1', 'ESERCIZIO', '1 SETT.'), r('A1', 'Panca piana', '4x8'), r('A2', 'Rematore', '4x8')] },
  { name: 'una sola settimana, senza colonne delle settimane', today: false, rows: [r('GIORNO 1', 'Serie x rip', 'Recupero'), r('Panca', '4x8', '90"')] },
  { name: 'prescrizione dentro il nome', today: false, rows: [r('GIORNO 1', 'NOTE', '1 SETT.'), r('Panca piana 4x8'), r('Squat 5x5')] },
  { name: 'foglio in inglese', today: false, rows: [r('WEEK 1', 'Sets', 'Reps'), r('Day 1'), r('Bench press', '4', '8')] }
];
