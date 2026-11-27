import { t } from './i18n';

/** Un pezzo della prescrizione: «4x8-10», «2x15», «1xMAX». */
export interface PrescriptionPart {
  sets: number;
  /** ripetizioni (il minimo, se è una forbice) */
  reps: number;
  /** massimo della forbice: «8-10» → reps 8, repsMax 10 */
  repsMax?: number;
  isMax: boolean;
}

export interface Prescription {
  sets: number;
  /** ripetizioni target per ogni serie (il minimo della forbice, se c'è) */
  reps: number[];
  /** massimo della forbice per ogni serie, se il coach ha scritto «8-10» */
  repsMax?: number[];
  /** tutte le serie al massimo */
  isMax: boolean;
  increaseWeight: boolean;
  /** false: il testo non si capisce e serie e ripetizioni sono un'ipotesi (3×10) */
  understood: boolean;
  /** pezzi nell'ordine scritto: «2x15 + 1xMAX» = due pezzi */
  parts: PrescriptionPart[];
  /** tempo di esecuzione, «3-1-1-0» o «30X1» */
  tempo?: string;
  rpe?: number;
  rir?: number;
  /** percentuale del massimale, «5x5 @80%» */
  percent?: number;
  /** recupero scritto nella cella, «4x8 rec 90"» */
  restSec?: number;
  /** «per lato», «per gamba», «dx+sx», «4x6+6» */
  perSide?: boolean;
  /** dropset, rest-pause, stripping, «3x(10+10)» */
  dropset?: boolean;
}

/** Ripetizioni proposte quando la scheda dice "MAX" */
export const MAX_REPS_DEFAULT = 12;
const MAX_SETS = 10;

const fallback = (increaseWeight = false): Prescription => ({
  sets: 3, reps: [10, 10, 10], isMax: false, increaseWeight, understood: false, parts: [{ sets: 3, reps: 10, isMax: false }]
});

const clampSets = (n: number) => (!Number.isFinite(n) || n < 1 ? 1 : Math.min(MAX_SETS, Math.round(n)));
const clampReps = (n: number) => Math.max(1, Math.round(n));
const num = (s: string) => Number(s.replace(',', '.'));

/** «90"», «90''», «90 sec», «2'», «2 min», «1'30"», «1.30'»: secondi */
function durationSec(s: string): number | undefined {
  const ms = s.match(/^(\d+)\s*['’′]\s*(\d+)\s*(?:"|''|″|”)?/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  const sec = s.match(/^(\d+)\s*(?:"|''|″|”|SEC(?:ONDI)?|S(?![A-Z]))/);
  if (sec) return Number(sec[1]);
  const min = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:'|’|′|MIN(?:UTI)?(?![A-Z]))/);
  if (min) return Math.round(num(min[1]) * 60);
  return undefined;
}

/**
 * Toglie dal testo le indicazioni che non sono serie e ripetizioni (tempo, RPE, %, recupero, tecniche)
 * e le restituisce a parte, così i numeri rimasti sono solo serie e ripetizioni.
 */
function extractExtras(text: string): { rest: string; extras: Partial<Prescription> } {
  const extras: Partial<Prescription> = {};
  let s = text;
  const cut = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) { fn(m); s = s.replace(m[0], ' '); }
  };
  // tempo di esecuzione con la parola: «tempo 3-1-1-0», «TUT 3010», «tempo 30X1»
  cut(/(?:TEMPO|TUT|CADENZA)\s*[:=]?\s*([0-9X])\s*-?\s*([0-9X])\s*-?\s*([0-9X])\s*-?\s*([0-9X])(?![0-9])/, (m) => { extras.tempo = m.slice(1, 5).join('-'); });
  // tempo da solo: quattro cifre singole con uno 0 o una X («3-1-1-0», «2-0-X-0»); «4-3-2-1» resta una piramide
  if (!extras.tempo) {
    const m = s.match(/(?:^|[^0-9])([0-9X])\s*-\s*([0-9X])\s*-\s*([0-9X])\s*-\s*([0-9X])(?![0-9-])/);
    const parts = m ? m.slice(1, 5) : [];
    if (m && parts.some((p) => p === '0' || p === 'X')) {
      extras.tempo = parts.join('-');
      s = s.replace(m[0], ' ');
    }
  }
  cut(/RPE\s*[:=]?\s*(\d+(?:[.,]5)?)/, (m) => { extras.rpe = num(m[1]); });
  cut(/RIR\s*[:=]?\s*(\d)/, (m) => { extras.rir = Number(m[1]); });
  cut(/@?\s*(\d{2,3})\s*%(?:\s*(?:1RM|RM|DEL MASSIMALE|MASSIMALE))?/, (m) => { extras.percent = Number(m[1]); });
  cut(/(?:^|[^A-Z])(?:REC(?:UPERO)?|RIP(?:OSO)?(?=\s*\.?\s*\d)|PAUSA|REST|R(?=\s*\.?\s*\d))\.?\s*[:=]?\s*(\d+(?:[.,]\d+)?\s*(?:['’′]\s*\d+\s*(?:"|''|″|”)?|"|''|″|”|'|’|′|SEC(?:ONDI)?|S(?![A-Z])|MIN(?:UTI)?))/, (m) => {
    extras.restSec = durationSec(m[1].trim());
  });
  if (/PER\s*LATO|X\s*LATO|PER\s*(?:GAMBA|BRACCIO)|EACH\s*SIDE|PER\s*SIDE|DX\s*\+?\s*(?:E\s*)?SX/.test(s)) extras.perSide = true;
  if (/DROP|STRIP|REST[\s-]?PAUSE|MYO/.test(s)) extras.dropset = true;
  return { rest: s, extras };
}

/** Un pezzo: «4x8-10», «3 serie da 10», «4xMAX», «3x(10+10)», «10-9-8..», «10/8/6». */
function parsePart(raw: string, extras: Partial<Prescription>): PrescriptionPart[] | null {
  const s = raw.replace(/\b(?:RIPETIZIONI|RIP|REPS?|SERIE|SETS?)\b\.?/g, (w) => (/^SERIE|^SETS?/.test(w) ? ' X ' : ' ')).replace(/\s+/g, ' ').trim();
  const p = raw.replace(/\s+/g, ' ').trim();

  // «4xMAX», «4 x max»
  const max = s.match(/(\d+)\s*X\s*(?:X\s*)?MAX/);
  if (max) return [{ sets: clampSets(Number(max[1])), reps: MAX_REPS_DEFAULT, isMax: true }];
  // «3x(10+10)», «4x6+6»: due numeri uniti nella stessa serie (dropset o per lato)
  const combo = s.match(/(\d+)\s*X\s*(?:X\s*)?\(?\s*(\d+)\s*\+\s*(\d+)\s*\)?/);
  if (combo) {
    // «4x6+6» con numeri uguali e senza parentesi è per lato; «3x(10+10)» o «3x12+8» è un dropset
    if (combo[2] === combo[3] && !extras.dropset && !/\(/.test(combo[0])) extras.perSide = true;
    else extras.dropset = true;
    return [{ sets: clampSets(Number(combo[1])), reps: clampReps(Number(combo[2])), isMax: false }];
  }
  // «4x8-10», «3x10/12», «3 serie da 8-12»: forbice
  const range = s.match(/(\d+)\s*X\s*(?:X\s*)?(?:DA\s*|DI\s*)?(\d+)\s*(?:-|\/|A)\s*(\d+)(?!\s*[-/]\s*\d)/);
  if (range) {
    const [a, b] = [Number(range[2]), Number(range[3])].sort((x, y) => x - y);
    return [{ sets: clampSets(Number(range[1])), reps: clampReps(a), repsMax: b > a ? b : undefined, isMax: false }];
  }
  // «3x10», «3 x 10», «3 serie da 10», «4 serie x 8 rip»
  const fixed = s.match(/(\d+)\s*X\s*(?:X\s*)?(?:DA\s*|DI\s*)?(\d+)/);
  if (fixed) return [{ sets: clampSets(Number(fixed[1])), reps: clampReps(Number(fixed[2])), isMax: false }];
  // «8-10» da solo: forbice (due numeri, il secondo più grande); 3 serie è un'ipotesi
  const lone = p.match(/^(\d+)\s*-\s*(\d+)\.*$/);
  if (lone && Number(lone[2]) > Number(lone[1])) return [{ sets: 3, reps: clampReps(Number(lone[1])), repsMax: Number(lone[2]), isMax: false }];
  // piramidi: «10-9-8..», «12-10», «10/8/6», «12,10,8,6»
  // con «/» e «,» servono almeno tre numeri e nient'altro dopo: «12,5» o «40/42» sono carichi, non serie
  const list = p.match(/^\d+(?:\s*-\s*\d+)+(?:\s*\.+)?(?!\s*(?:KG|%))/) ?? p.match(/^\d+(?:\s*([/,])\s*\d+)(?:\s*\1\s*\d+)+\s*\.*$/);
  if (list) {
    const reps = list[0].replace(/\.+$/, '').split(/[-/,]/).map((n) => clampReps(Number(n.trim())));
    return reps.slice(0, MAX_SETS).map((r) => ({ sets: 1, reps: r, isMax: false }));
  }
  // «MAX» da solo: una serie al massimo
  if (/^MAX$/.test(p)) return [{ sets: 1, reps: MAX_REPS_DEFAULT, isMax: true }];
  return null;
}

/**
 * Interpreta la prescrizione scritta nella scheda.
 * Esempi: "3X10", "4x8 AUMENTO PESO", "10-9-8..", "4xMAX", "4x8-10", "10/8/6", "2x15 + 1xMAX",
 * "5x5 @80%", "3x10 RPE 8", "4x10 tempo 3-1-1-0", "4X8 rec 90\"", "3x12 per lato", "3x(10+10)".
 * Se non capisce, propone 3×10 e lo dice (understood: false).
 */
export function parsePrescription(raw: string | undefined | null): Prescription {
  if (!raw || !raw.trim()) return fallback();
  const text = raw.trim().toUpperCase().replace(/×/g, 'X').replace(/\s+/g, ' ');
  const increaseWeight = /AUMENTO|\+\s*PESO|(?:^|[^A-Z])UP(?![A-Z])/.test(text);
  const { rest, extras } = extractExtras(text.replace(/AUMENTO(?:\s*(?:DI\s*)?(?:PESO|CARICO))?|\+\s*PESO/g, ' '));

  // le parti si sommano: «2x15 + 1xMAX»; il «+» dentro «4x6+6» o «3x(10+10)» resta nella serie
  const pieces = rest.split(/\+(?!\s*\d+\s*\)?(?:\s|$|[^X0-9]))/).map((x) => x.trim()).filter(Boolean);
  const parts: PrescriptionPart[] = [];
  for (const piece of pieces) {
    const found = parsePart(piece, extras);
    if (found) parts.push(...found);
  }
  if (!parts.length) return { ...fallback(increaseWeight), ...extras };

  // le serie in fila, al massimo 10
  const reps: number[] = [];
  const repsMax: number[] = [];
  let hasRange = false;
  let allMax = true;
  for (const part of parts) {
    for (let i = 0; i < part.sets && reps.length < MAX_SETS; i++) {
      reps.push(part.reps);
      repsMax.push(part.repsMax ?? part.reps);
    }
    if (part.repsMax) hasRange = true;
    if (!part.isMax) allMax = false;
  }
  return {
    sets: reps.length,
    reps,
    ...(hasRange ? { repsMax } : {}),
    isMax: allMax,
    increaseWeight,
    understood: true,
    parts,
    ...extras
  };
}

/** La cella contiene una prescrizione che si capisce? */
export const isPrescriptionText = (raw: string | undefined | null) => parsePrescription(raw).understood;

const repsText = (part: PrescriptionPart) => (part.repsMax ? `${part.reps}-${part.repsMax}` : String(part.reps));

/** Testo leggibile, es. "3 × 10", "4 × 8-10", "3 serie: 10, 9, 8", "2 × 15 + 1 al massimo" */
export function describePrescription(raw: string | undefined): string {
  const p = parsePrescription(raw);
  if (!p.understood) return t('non la capisco: propongo 3 × 10');
  let base: string;
  if (p.isMax) base = t('{n} serie al massimo', { n: p.sets });
  else if (p.parts.every((x) => x.sets === 1 && !x.repsMax && !x.isMax) && p.parts.length > 1) base = t('{n} serie: {reps}', { n: p.sets, reps: p.reps.join(', ') });
  else {
    base = p.parts
      .map((x) => (x.isMax ? t('{n} al massimo', { n: x.sets }) : `${x.sets} × ${repsText(x)}`))
      .join(' + ');
  }
  const extra: string[] = [];
  if (p.perSide) extra.push(t('per lato'));
  if (p.dropset) extra.push(t('dropset'));
  if (p.percent) extra.push(`${p.percent}%`);
  if (p.rpe !== undefined) extra.push(`RPE ${String(p.rpe).replace('.', ',')}`);
  if (p.rir !== undefined) extra.push(`RIR ${p.rir}`);
  if (p.tempo) extra.push(t('tempo {tempo}', { tempo: p.tempo }));
  if (extra.length) base = `${base} ${extra.join(' · ')}`;
  return p.increaseWeight ? t('{base}, aumenta il carico', { base }) : base;
}
