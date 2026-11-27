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

/**
 * Scheda di un secondo coach, ricostruita con la stessa struttura di una scheda vera ma con dati inventati:
 * niente colonna NOTE, settimane dalla colonna B (con «6 SETT.» ripetuto per sbaglio al posto di 7 e 8),
 * sezioni «SERIE X REP RIP. 2'» con la forbice in ogni settimana («2X5/7») e, nelle righe degli esercizi,
 * quello che l'atleta scrive a mano: carico e ripetizioni fatte («72. 7-6», «18 cavi b. 11-10»).
 */
const W8 = (p: string) => Array(8).fill(p) as string[];
const W7 = (p: string) => Array(7).fill(p) as string[];
export const COACH_B: string[][] = [
  r(''),
  r('', 'PROGRAMMA PALESTRA'),
  r('', ' • LUCA PERSONAL TRAINER'),
  r(''),
  r('GIORNO 1', '1 SETT.', '2 SETT.', '3 SETT.', '4 SETT.', '5 SETT.', '6 SETT.', '6 SETT.', '6 SETT.'),
  r("SERIE X REP RIP. 2'", ...W8('2X5/7')),
  r('DISTENSIONI \nMULTIPOWER PIANA', '72. \n7-6', '62. \n6-5', '62. \n8-7', '68. \n5-4', '68. \n6-5', '68. \n6-5', '58. \n10-9', '58. \n10-8'),
  r(' REMATORE MANUBRI \nPANCA 30', '28. \n7-6', '30 \n6-5', '30 \n8-6', '30. \n9-8', '32. \n8-7', '32. \n8-7', '28. \n12-12', '32. \n9-8'),
  r("SERIE X REP RIP. 2'", ...W8('2X7/9')),
  r('CROCI MANUBRI \nINCLINATA', '16. \n11-9', '18. \n7-6', '18. \n7-6', '18. \n9-7', '18. \n9-7', '14/16 all. \n11-9', '8 cavi b. \n12-12', '10 cavi b. \n9-8'),
  r(' ALZATE LATERALI \nPIEDI', '8/10. \n8-7', '10/12. \n10-7', '10sed. \n10-10', '18/20spinte \n10-7', '20spinte \n9-7', '8/10 lat. \n14-13-9', '4/5 lat p. 45. \n12-10-10', '6 lat p. 45. \n8-7-6...'),
  r(''), r(''),
  r('GIORNO 2', '1 SETT.', '2 SETT.', '3 SETT.', '4 SETT.', '5 SETT.', '6 SETT.', '7 SETT.'),
  r("SERIE X REP RIP. 2'", ...W7('2X5/7')),
  r('PRESSA 45', '220. \n7-6', '220. \n7-6', '210 \n6-5', '210 \n7-5', '215 \n6-5', '215 \n6-5', '60 squat \n10-9'),
  r("SERIE X REP RIP. 2'", ...W7('2X6/8')),
  r('CURL BILANCIERE \nPANCA SCOTT', '22. \n7-5', '22. \n8-6', '22. \n9-6', '22. \n9-6', '22. \n9-8', '22. \n10-9', '24. \n7-6'),
  r(''),
  r("SERIE X REP RIP. 2'", ...W7('3X9/11')),
  r('DANNUNZIO', '9-7', '9-7', '11/10/8...', '12/8/7....', '6. \n7-8-6', '6. \n7-8-6', ''),
  r('ROTELLA', '15-10-7...', '', '', '', '18-10-8....'),
  r(''),
  r('GIORNO 3', '1 SETT.', '2 SETT.'),
  r('JUMP SET RIP. \n90', '2x8/10', '2x8/10'),
  r('LENTO AVANTI \nMULTIPOWER', '32. \n9-8'),
  r('', '2x10/12', '2x10/12'),
  r('CHEST PRESS \nPRESA SOTTO', '62. \n9-8'),
  r("SERIE X REP \nRIP. 2'"),
  r('CRUNCH CAVO')
];

/** La sua scheda delle misure: «SETTIMANE» con i numeri soli. */
export const COACH_B_MISURE: string[][] = [
  r(''),
  r('', 'PROGRAMMA PALESTRA'),
  r('', 'MARCO •  LUCA PERSONAL TRAINER'),
  r(''),
  r('SETTIMANE', '1', '2', '3', '4'),
  r('PESO', '81.2', '81', '80,6', '80.4'),
  r('ADDOME', '88.5', '88', '88', '87.5'),
  r(''),
  r('SETTIMANE', '1', '2', '3', '3'),
  r('KCAL', '2300', '2300', '2100', '2100')
];
