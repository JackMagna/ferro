/**
 * Righe della scheda che non sono «carico × ripetizioni»: cardio, nuoto, tenute, ripetute, blocchi (AMRAP, EMOM, For Time).
 * Lettore a regole, nessuna IA. La fonte resta il testo del coach (exercise.weeks): qui lo si interpreta e basta,
 * così vale sia per le schede importate dal foglio sia per quelle scritte a mano nell'app.
 * Se una riga non si capisce, diventa «testo»: in allenamento si mostra com'è, con «Fatto».
 *
 * Regole della casa: niente \b con lettere accentate (si usano confini espliciti), l'apice ' è ambiguo
 * (minuti in «20' corsa», secondi nel nuoto in «a 45'» e «r 15'»): si decide guardando disciplina e contesto.
 */
import type { ProgramBlock, ProgramExercise } from '../types';
import { parsePrescription } from './prescription';

export type Activity = NonNullable<ProgramExercise['activity']>;

export type ActivityPlan =
  | { kind: 'carico' }
  /** tenute: «3x45''», «hold 30''» (plank, isometrie) */
  | { kind: 'tenuta'; sets: number; timeSec: number }
  | { kind: 'tempo'; timeSec: number; target?: string }
  | { kind: 'distanza'; distanceM: number; timeSec?: number; target?: string }
  /** ripetute: «6x1000 r 2'», «10x1' / 1'», «8x100 SL r 15''» */
  | { kind: 'intervalli'; reps: number; workSec?: number; workM?: number; restSec?: number; sendOffSec?: number; stroke?: string; target?: string }
  /** seduta di nuoto con più parti: si conta il totale in metri */
  | { kind: 'nuoto'; totalM: number; parts: string[] }
  /** esercizio dentro un blocco (AMRAP, EMOM…): quantità com'è scritta («15», «200 m», «10 cal») */
  | { kind: 'blocco'; text: string }
  /** riga non capita: si mostra il testo del coach */
  | { kind: 'testo'; text: string };

const lower = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** confine di parola che funziona anche con lettere accentate */
const word = (src: string) => new RegExp(`(^|[^a-z0-9])(?:${src})(?=$|[^a-z0-9])`);

const ACTIVITY_WORDS: [Activity, RegExp][] = [
  ['nuoto', word('nuoto|nuotare|vasche?|piscina|swim(?:ming)?|stile libero|dorso|rana|delfino|farfalla|misti')],
  ['corsa', word('corsa|correre|run(?:ning)?|jog(?:ging)?|tapis(?: roulant)?|treadmill|ripetute|fartlek|lungo')],
  ['bici', word('bici|bicicletta|cyclette|spinning|bike|cycling|ciclismo|rulli|indoor cycle|assault bike|air bike|echo bike')],
  ['vogatore', word('vogatore|remoergometro|rowing machine|rower|row erg|concept ?2|ski ?erg')],
  ['ellittica', word('ellittica|ellittico|elliptical|cross ?trainer')],
  ['camminata', word('camminata|cammino|walk(?:ing)?|passeggiata|step(?:per)?|scale')],
  ['pilates', word('pilates|reformer')],
  ['mobilita', word('mobilita|stretching|allungamento|yoga|foam roller|defaticamento')]
];

/** Disciplina dal nome dell'esercizio («Cyclette», «Corsa lenta», «Nuoto»…). Predefinita: forza. */
export function activityOf(name: string): Activity {
  const n = lower(name);
  for (const [a, re] of ACTIVITY_WORDS) if (re.test(n)) return a;
  return 'forza';
}

export const isCardio = (a: Activity) => a === 'corsa' || a === 'bici' || a === 'nuoto' || a === 'vogatore' || a === 'ellittica' || a === 'camminata';

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNum = (s: string) => Number(s.replace(',', '.'));
const SEC_UNIT = String.raw`(?:''|"|″|”|sec(?:ondi)?|s(?![a-z]))`;
const MIN_UNIT = String.raw`(?:'|’|′|min(?:uti)?(?![a-z]))`;

/** «1h30», «1h», «1:30:00», «45'», «30 min», «90''», «1'30''», «1.25» (m.ss dopo «a», ripartenza nel nuoto) */
function durationIn(text: string, swim: boolean): number | undefined {
  const t = text;
  const hm = t.match(/(\d+)\s*h\s*(\d{1,2})?/);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2] ?? 0) * 60;
  const clock = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (clock) return clock[3] !== undefined ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) : Number(clock[1]) * 60 + Number(clock[2]);
  const ms = t.match(new RegExp(`(\\d+)\\s*${MIN_UNIT}\\s*(\\d+)\\s*${SEC_UNIT}`));
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  const sec = t.match(new RegExp(`${NUM}\\s*${SEC_UNIT}`));
  if (sec) return Math.round(toNum(sec[1]));
  const min = t.match(new RegExp(`${NUM}\\s*${MIN_UNIT}`));
  if (min) return Math.round(toNum(min[1]) * (swim ? 1 : 60));
  return undefined;
}

/** «r 15''», «rec 2'», «rec. 1'30''», «/ 1'» (recupero) — nel nuoto «r 15'» sono secondi */
function restIn(text: string, swim: boolean): number | undefined {
  const m = text.match(/(?:^|[^a-z])(?:r|rec|recupero|riposo|pausa|rest)\.?\s*[:=]?\s*([0-9][^,;+()]*)/) ?? text.match(/\/\s*([0-9][^,;+()]*)/);
  return m ? durationIn(m[1], swim) : undefined;
}

/** «a 1.25», «a 1'25''», «@1:45», «ripartenza 1.30»: ripartenza nel nuoto */
function sendOffIn(text: string): number | undefined {
  const m = text.match(/(?:^|\s)(?:a|@|ripartenza|partenza|ogni)\s*(\d+)[.:,](\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = text.match(/(?:^|\s)(?:a|ripartenza|ogni)\s*(\d+)\s*(?:'|’|′|''|"|″)/);
  return n ? Number(n[1]) : undefined;
}

function distanceIn(text: string): number | undefined {
  const km = text.match(new RegExp(`${NUM}\\s*km`));
  if (km) return Math.round(toNum(km[1]) * 1000);
  const m = text.match(/(\d+)\s*(?:m|mt|metri)(?![a-z])/);
  return m ? Number(m[1]) : undefined;
}

/** zona o obiettivo: «Z2», «B1», «@ 300 W», «4'30"/km», «60 rpm», «RPE 7», «soglia», «lento» */
function targetIn(text: string): string | undefined {
  const found: string[] = [];
  const z = text.match(/(?:^|[^a-z])(z[1-7]|b[1-3]|zona\s*[1-7])(?=$|[^a-z0-9])/);
  if (z) found.push(z[1].toUpperCase().replace(/ZONA\s*/, 'Z'));
  const w = text.match(/(\d{2,4})\s*(?:w|watt)(?![a-z])/);
  if (w) found.push(`${w[1]} W`);
  const pace = text.match(/(\d{1,2})\s*['’:.]\s*(\d{2})\s*(?:"|''|″)?\s*\/\s*km/);
  if (pace) found.push(`${pace[1]}'${pace[2]}"/km`);
  const rpm = text.match(/(\d{2,3})\s*rpm/);
  if (rpm) found.push(`${rpm[1]} rpm`);
  const rpe = text.match(/rpe\s*(\d{1,2})/);
  if (rpe) found.push(`RPE ${rpe[1]}`);
  const feel = text.match(word('lento|lenta|medio|media|forte|veloce|soglia|progressivo|facile|easy|tempo run'));
  if (feel) found.push(feel[0].trim());
  return found.length ? found.join(' · ') : undefined;
}

const STROKES: [string, RegExp][] = [
  ['SL', word('sl|stile libero|crawl|free(?:style)?')],
  ['DO', word('do|dorso|back(?:stroke)?')],
  ['RA', word('ra|rana|breast(?:stroke)?')],
  ['FA', word('fa|df|delfino|farfalla|fly|butterfly')],
  ['MX', word('mx|misti|im|medley')]
];
const strokeIn = (text: string) => STROKES.find(([, re]) => re.test(text))?.[0];

/** Prescrizione «da palestra»: 3X10, 4xMAX, 10-9-8, senza unità di tempo o distanza. */
const STRENGTH_RE = /(\d+\s*[x×]\s*(\d+|max)(?!\s*(?:''|"|″|'|’|′|m(?![a-z])|km|min|sec|s(?![a-z])|cal)))|^\d+(\s*-\s*\d+)+|max/;

/** Il testo parla di tempo, distanza o blocchi? (serve al lettore del foglio per non scartare la cella) */
export function looksLikeActivityText(raw: string): boolean {
  const t = lower(raw);
  return new RegExp(`\\d\\s*(?:km|${MIN_UNIT}|${SEC_UNIT}|h\\s*\\d|m(?![a-z])|mt|metri|cal)|\\d:\\d{2}|amrap|emom|for time|tabata|rft|z[1-7](?![0-9])`).test(t);
}

/** Legge la cella della settimana (testo del coach) per un esercizio di una data disciplina. */
export function parseActivity(raw: string | undefined, activity: Activity): ActivityPlan {
  const original = (raw ?? '').trim();
  const t = lower(original).replace(/\s+/g, ' ');
  const swim = activity === 'nuoto';
  if (!t) return isCardio(activity) || activity === 'pilates' || activity === 'mobilita' ? { kind: 'testo', text: '' } : { kind: 'carico' };

  // forza: «3X10», «4xMAX», «10-9-8..» restano carico × ripetizioni
  if (!isCardio(activity) && STRENGTH_RE.test(t) && !looksLikeActivityText(t.replace(/(?:rec|r|riposo|recupero)\.?\s*\d+\s*(?:''|"|″|'|’|′|min|sec|s)/g, ''))) return { kind: 'carico' };

  // nuoto con più parti: «400 risc + 8x50 SL r 15'' + 200 def», una per riga o separate da + , ;
  if (swim) {
    const parts = original.split(/\n|\+|;|,(?!\d)/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const totalM = parts.reduce((sum, p) => sum + swimMeters(lower(p)), 0);
      if (totalM > 0) return { kind: 'nuoto', totalM, parts };
    }
  }

  // ripetute: «6x1000 r 2'», «10x1' / 1'», «8x100 SL r 15''», «3x(5' Z3 / 2')»
  const rep = t.match(/^(\d+)\s*[x×]\s*\(?\s*(\d+(?:[.,]\d+)?)\s*(km|m(?![a-z])|mt|metri|''|"|″|'|’|′|min|sec|s(?![a-z]))?/);
  if (rep) {
    const reps = Number(rep[1]);
    const value = toNum(rep[2]);
    const unit = rep[3];
    const rest = restIn(t.slice(rep[0].length), swim);
    const base = { reps, restSec: rest, target: targetIn(t), stroke: swim ? strokeIn(t) : undefined, sendOffSec: swim ? sendOffIn(t) : undefined };
    if (unit === 'km') return { kind: 'intervalli', ...base, workM: Math.round(value * 1000) };
    if (unit && /^(m|mt|metri)$/.test(unit)) return { kind: 'intervalli', ...base, workM: value };
    if (unit && /^(''|"|″|sec|s)$/.test(unit)) {
      return isCardio(activity) ? { kind: 'intervalli', ...base, workSec: value } : { kind: 'tenuta', sets: reps, timeSec: value };
    }
    if (unit) {
      // minuti (nel nuoto un apice dopo il numero della ripetuta resta minuti: «4x5'»)
      return isCardio(activity) ? { kind: 'intervalli', ...base, workSec: Math.round(value * 60) } : { kind: 'tenuta', sets: reps, timeSec: Math.round(value * 60) };
    }
    // senza unità: metri nel nuoto e nella corsa (8x100, 6x1000), minuti per bici, vogatore, ellittica (10x1)
    if (swim || activity === 'corsa' || activity === 'camminata') return { kind: 'intervalli', ...base, workM: value };
    if (isCardio(activity)) return { kind: 'intervalli', ...base, workSec: Math.round(value * 60) };
  }

  // tenuta singola: «hold 30''», «plank 1'»
  if (!isCardio(activity) && /^(?:hold|tenuta|isometria)?\s*\d/.test(t)) {
    const sec = durationIn(t, false);
    if (sec && !distanceIn(t)) return activity === 'forza' ? { kind: 'tenuta', sets: 1, timeSec: sec } : { kind: 'tempo', timeSec: sec, target: targetIn(t) };
  }

  // distanza (con tempo eventuale): «5 km», «400 m», «10 km in 50'»
  const dist = distanceIn(t);
  if (dist) {
    const rest = t.replace(new RegExp(`${NUM}\\s*(?:km|m(?![a-z])|mt|metri)`), ' ');
    return { kind: 'distanza', distanceM: dist, timeSec: durationIn(rest, false), target: targetIn(t) };
  }
  // tempo: «20'», «45 min», «1h30», «30' Z2»
  const sec = durationIn(t, false);
  if (sec) return { kind: 'tempo', timeSec: sec, target: targetIn(t) };
  // nuoto con un numero solo: «1500» = metri
  if (swim && /^\d{2,4}(?![0-9])/.test(t)) return { kind: 'distanza', distanceM: Number(t.match(/^\d+/)![0]) };

  if (!isCardio(activity) && STRENGTH_RE.test(t)) return { kind: 'carico' };
  return { kind: 'testo', text: original };
}

/** Metri di una parte di seduta di nuoto: «8x50» = 400, «400 risc» = 400, «200 m» = 200. */
function swimMeters(p: string): number {
  const rep = p.match(/(\d+)\s*[x×]\s*\(?\s*(\d+)\s*[x×]\s*(\d+)/);
  if (rep) return Number(rep[1]) * Number(rep[2]) * Number(rep[3]);
  const sets = p.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (sets) return Number(sets[1]) * Number(sets[2]);
  const m = p.match(/(\d{2,4})\s*(?:m|mt|metri)?(?![0-9'’″"])/);
  return m && Number(m[1]) >= 25 ? Number(m[1]) : 0;
}

/** Cosa fa l'esercizio in questa settimana: blocco, carico, tempo, distanza, ripetute, nuoto, tenuta o testo. */
export function planFor(ex: ProgramExercise, week: number): ActivityPlan {
  const text = ex.weeks[week];
  if (ex.blockId) return { kind: 'blocco', text: (text ?? '').trim() };
  return parseActivity(text, ex.activity ?? activityOf(ex.name));
}

export const isLoadPlan = (p: ActivityPlan) => p.kind === 'carico';

/**
 * Quante serie prevede l'esercizio nella settimana: carico = quelle della prescrizione, tenute = quante tenute,
 * tutto il resto (cardio, nuoto, blocchi, testo) = una voce sola da segnare come fatta. 0 se la cella è vuota.
 */
export function plannedSetCount(ex: ProgramExercise, week: number): number {
  if (!ex.weeks[week]) return 0;
  const plan = planFor(ex, week);
  if (plan.kind === 'carico') return parsePrescription(ex.weeks[week]).reps.length;
  if (plan.kind === 'tenuta') return plan.sets;
  return 1;
}

/* ---------- testi per l'interfaccia ---------- */

export function formatDuration(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}' ${s}"` : `${m} min`;
  }
  return `${sec}"`;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${String(Math.round((m / 1000) * 100) / 100).replace('.', ',')} km` : `${m} m`;
}

const STROKE_NAMES: Record<string, string> = { SL: 'stile libero', DO: 'dorso', RA: 'rana', FA: 'delfino', MX: 'misti' };

/** «6 ripetute da 1000 m, recupero 2 min», «20 min · Z2», «3 tenute da 45"» */
export function describePlan(p: ActivityPlan): string {
  switch (p.kind) {
    case 'carico':
      return '';
    case 'tenuta':
      return p.sets > 1 ? `${p.sets} tenute da ${formatDuration(p.timeSec)}` : `Tenuta di ${formatDuration(p.timeSec)}`;
    case 'tempo':
      return [formatDuration(p.timeSec), p.target].filter(Boolean).join(' · ');
    case 'distanza':
      return [formatDistance(p.distanceM), p.timeSec ? `in ${formatDuration(p.timeSec)}` : '', p.target].filter(Boolean).join(' · ');
    case 'intervalli': {
      const work = p.workM ? formatDistance(p.workM) : p.workSec ? formatDuration(p.workSec) : '';
      const parts = [`${p.reps} ripetute${work ? ` da ${work}` : ''}${p.stroke ? ` ${STROKE_NAMES[p.stroke] ?? p.stroke}` : ''}`];
      if (p.sendOffSec) parts.push(`partenza ogni ${formatDuration(p.sendOffSec)}`);
      if (p.restSec) parts.push(`recupero ${formatDuration(p.restSec)}`);
      if (p.target) parts.push(p.target);
      return parts.join(', ');
    }
    case 'nuoto':
      return `${formatDistance(p.totalM)} in totale, ${p.parts.length} parti`;
    case 'blocco':
      return /^\d+$/.test(p.text) ? `${p.text} ripetizioni` : p.text;
    case 'testo':
      return p.text;
  }
}

/** Valori da proporre nel diario: durata e distanza totali previste. */
export function plannedTotals(p: ActivityPlan): { durationSec?: number; distanceM?: number } {
  switch (p.kind) {
    case 'tempo':
      return { durationSec: p.timeSec };
    case 'distanza':
      return { distanceM: p.distanceM, durationSec: p.timeSec };
    case 'intervalli':
      return {
        distanceM: p.workM ? p.workM * p.reps : undefined,
        durationSec: p.workSec ? p.workSec * p.reps + (p.restSec ?? 0) * Math.max(0, p.reps - 1) : undefined
      };
    case 'nuoto':
      return { distanceM: p.totalM };
    default:
      return {};
  }
}

/* ---------- blocchi: AMRAP, EMOM, For Time, giri, Tabata ---------- */

/** Intestazione di blocco nel foglio: «AMRAP 12'», «EMOM 10'», «For Time (cap 15')», «5 RFT», «Circuito x3», «Tabata». */
export function parseBlockHeader(raw: string): Omit<ProgramBlock, 'id'> | null {
  const t = lower(raw).replace(/\s+/g, ' ').trim();
  const minutes = (s: string | undefined) => (s ? Math.round(toNum(s) * 60) : undefined);
  const amrap = t.match(/^amrap\s*(\d+(?:[.,]\d+)?)?/);
  if (amrap) return { format: 'amrap', durationSec: minutes(amrap[1]), score: 'giri_rip', rawText: raw.trim() };
  const emom = t.match(/^(?:emom|e\d?mom)\s*(\d+)?|^ogni\s*(\d+)\s*(?:'|’|min)\s*(?:x|per)\s*(\d+)/);
  if (emom) {
    if (emom[2]) return { format: 'emom', everySec: Number(emom[2]) * 60, rounds: Number(emom[3]), score: 'fatto', rawText: raw.trim() };
    return { format: 'emom', everySec: 60, durationSec: minutes(emom[1]), score: 'fatto', rawText: raw.trim() };
  }
  const cap = t.match(/cap\s*(\d+)/);
  if (/^(?:for time|ft)(?=$|[^a-z])/.test(t)) return { format: 'for_time', timeCapSec: minutes(cap?.[1]), score: 'tempo', rawText: raw.trim() };
  const rft = t.match(/^(\d+)\s*(?:rft|rounds? for time|giri per tempo)/);
  if (rft) return { format: 'for_time', rounds: Number(rft[1]), timeCapSec: minutes(cap?.[1]), score: 'tempo', rawText: raw.trim() };
  if (/^tabata/.test(t)) return { format: 'intervalli', workSec: 20, restSec: 10, rounds: 8, score: 'rip', rawText: raw.trim() };
  const circuit = t.match(/^(?:circuito|circuit|superserie|superset|giant set)\s*(?:x\s*(\d+)|(\d+)\s*(?:giri|round))?/);
  if (circuit) return { format: /super|giant/.test(t) ? 'superset' : 'circuito', rounds: circuit[1] || circuit[2] ? Number(circuit[1] ?? circuit[2]) : undefined, score: 'fatto', rawText: raw.trim() };
  const giri = t.match(/^(\d+)\s*(?:giri|round)(?=$|[^a-z])/);
  if (giri) return { format: 'circuito', rounds: Number(giri[1]), score: 'fatto', rawText: raw.trim() };
  return null;
}

/** «AMRAP 12 min: più giri possibili», «For Time, massimo 15 min», «EMOM 10 min» */
export function describeBlock(b: ProgramBlock): string {
  switch (b.format) {
    case 'amrap':
      return `AMRAP${b.durationSec ? ` ${formatDuration(b.durationSec)}` : ''}: più giri possibili`;
    case 'emom':
      return `Ogni ${formatDuration(b.everySec ?? 60)}${b.durationSec ? ` per ${formatDuration(b.durationSec)}` : b.rounds ? `, ${b.rounds} volte` : ''}`;
    case 'for_time':
      return `${b.rounds ? `${b.rounds} giri ` : ''}per tempo${b.timeCapSec ? `, massimo ${formatDuration(b.timeCapSec)}` : ''}`;
    case 'intervalli':
      return `${b.rounds ?? 8} × ${b.workSec ?? 20}" lavoro / ${b.restSec ?? 10}" recupero`;
    case 'superset':
      return 'Superserie: esercizi uno dopo l\'altro';
    case 'circuito':
      return `Circuito${b.rounds ? `, ${b.rounds} giri` : ''}`;
    default:
      return b.rawText ?? '';
  }
}
