import type { ProgramBlock, ProgramDay, ProgramExercise, SectionType, WorkoutProgram } from '../types';
import { looksLikeActivityText, parseBlockHeader } from './activity';
import { isPrescriptionText, parsePrescription } from './prescription';

export interface ParsedSheet {
  program: WorkoutProgram;
  warnings: string[];
  exerciseCount: number;
}

const DAY_RE = /^(giorno|day|allenamento|workout)\s*([0-9]+|[a-d])\b/i;
const GUIDE_RE = /^modalit/i;

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "CHEST PRESS" -> "Chest press": solo se il testo è tutto maiuscolo */
export function sentenceCase(s: string): string {
  const t = clean(s);
  if (!t || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function weekOf(cell: string): number | null {
  const a = cell.match(/(\d+)\s*[°ª^]?\s*(?:sett|settimana|week|wk)\b/i);
  if (a) return Number(a[1]);
  const b = cell.match(/^(?:sett|settimana|week|wk)\.?\s*(\d+)\s*$/i);
  return b ? Number(b[1]) : null;
}

function sectionTypeOf(label: string): SectionType {
  if (/cedim/i.test(label)) return 'cedimento';
  if (/core|addom/i.test(label)) return 'core';
  return 'progressione';
}

function restFrom(label: string): number | null {
  const min = label.match(/rip(?:oso)?\.?\s*(\d+(?:[.,]\d+)?)\s*(?:'|’|′|min|m\b)/i);
  if (min) return Math.round(Number(min[1].replace(',', '.')) * 60);
  const sec = label.match(/rip(?:oso)?\.?\s*(\d+)\s*(?:"|''|″|sec|s\b)/i);
  if (sec) return Number(sec[1]);
  // senza unità («JUMP SET RIP. 90»): da 10 in su sono secondi, sotto sono minuti
  const bare = label.match(/rip(?:oso)?\.?\s*(\d+)\s*$/i);
  if (!bare) return null;
  const n = Number(bare[1]);
  return n >= 10 ? n : n * 60;
}

/** Una prescrizione vera ha "x", "MAX" o un trattino (3X10, 4xMAX, 10-9-8..): i numeri soli sono carichi scritti a mano. */
/**
 * Piramidi con «/» o «,» («12/10/8», «12,10,8,6»): almeno tre numeri, in discesa, fino a 30.
 * Così «40/42,5» o «12/14/16» scritti a mano restano carichi e non diventano serie.
 */
const isSlashPyramid = (v: string) => {
  const m = v.match(/^\d+(?:\s*([/,])\s*\d+)(?:\s*\1\s*\d+)+\s*\.*$/);
  if (!m) return false;
  const n = v.replace(/\.+$/, '').split(/[/,]/).map((x) => Number(x.trim()));
  return n.every((x, i) => x <= 30 && (i === 0 || x < n[i - 1]));
};
const isPrescription = (v: string) => /[x×]|max|\d\s*-\s*\d/i.test(v) || isSlashPyramid(v) || (/\d\s*serie/i.test(v) && isPrescriptionText(v));
/**
 * Toglie le nostre note ("3X10 · 40 kg", "40/42,5 kg") quando si rilegge un foglio già compilato dall'app.
 * Tiene le prescrizioni da palestra e anche quelle a tempo, distanza o ripetute ("20'", "5 km", "6x1000 r 2'").
 */
export function cleanCell(v: string): string {
  const t = clean(v);
  if (/^\d+([.,]\d+)?(\/\d+([.,]\d+)?)*\s*(kg|rip)$/i.test(t)) return '';
  const base = t.split(' · ')[0].trim();
  if (isAthleteLog(base) && !looksLikeActivityText(base)) return '';
  return isPrescription(base) || looksLikeActivityText(base) ? base : '';
}
/**
 * Quello che l'atleta scrive a mano dopo la serie: carico e poi ripetizioni fatte
 * («75. 7-6», «16/18 all. 11-9», «20 face pull. 7-7», «12sed. 10-10»). Non è una prescrizione.
 * Le liste di sole ripetizioni («10 - 8 - 6») e le prescrizioni con «x», MAX o «serie» restano.
 */
export function isAthleteLog(v: string): boolean {
  const t = v.trim();
  if (/\d\s*[x×]\s*(\d|max)|max|serie/i.test(t)) return false;
  if (/^\d+(\s*[-/,]\s*\d+)*\s*[-.]*$/.test(t)) return false;
  return /^\d+([.,]\d+)?\S*\s+.*\d/.test(t);
}

/** Prescrizione «vera» sulla riga dell'esercizio: serie per ripetizioni o MAX («4xMAX», «3x12»). */
const hasSetsTimesReps = (v: string) => /\d\s*[x×]\s*(\d|max)|max/i.test(v);

/** Dentro un blocco (AMRAP, EMOM…) anche un numero solo è una quantità ("15" ripetizioni), non un carico. */
const blockCell = (v: string) => clean(v).split(' · ')[0].trim();

const isSectionLabel = (c0: string) =>
  (/^(progressione|cedimento|core|addominali)\b/i.test(c0) && /(serie|rip|rec)/i.test(c0)) ||
  // «SERIE X REP RIP. 2'», «JUMP SET RIP. 90», «SET X REP»: intestazione con le prescrizioni nelle colonne
  (/^(serie|series|sets?|jump\s*set)(\s|$)/i.test(c0) && /(rip|rep|rec)/i.test(c0));
const isBareLabel = (c0: string) => /^(progressione|cedimento)\s*:?$/i.test(c0);

/**
 * Trasforma le celle del foglio del coach in una scheda.
 * Riconosce righe "GIORNO n" con colonne "n SETT.", intestazioni di sezione
 * ("PROGRESSIONE SERIE X REP RIP. 2'"), gli esercizi e le indicazioni finali.
 */
export function parseCoachSheet(rows: string[][], tab = ''): ParsedSheet {
  const warnings: string[] = [];
  const cell = (r: string[] | undefined, i: number) => clean(r?.[i]);
  const filled = (r: string[] | undefined) => (r ?? []).some((c) => clean(c) !== '');

  const dayStarts: number[] = [];
  rows.forEach((r, i) => {
    if (DAY_RE.test(cell(r, 0))) dayStarts.push(i);
  });
  if (dayStarts.length === 0) {
    throw new Error('Non trovo nessuna riga "GIORNO 1", "GIORNO 2"… in questo foglio. Controlla di aver scelto la scheda giusta.');
  }

  // Titolo, atleta e trainer dalle righe prima del primo giorno
  const head = rows.slice(0, dayStarts[0]).flatMap((r) => (r ?? []).map(clean).filter(Boolean));
  const title = head[0] ? sentenceCase(head[0]) : 'Programma palestra';
  let athlete = '';
  let trainer = '';
  if (head[1]) {
    // «• LUCA PERSONAL TRAINER» senza nome davanti: c'è solo il trainer
    const parts = head[1].split(/\s*[•·|–—]\s*|\s+-\s+|\s+con\s+/i).map(clean);
    athlete = sentenceCase(parts[0] ?? '');
    trainer = sentenceCase(parts.slice(1).filter(Boolean).join(' '));
  }

  const days: ProgramDay[] = [];
  const weekCols: Record<number, number> = {};
  let guidelinesStart = rows.length;

  dayStarts.forEach((start, di) => {
    const header = rows[start] ?? [];
    const cols: Record<number, number> = {};
    let noteCol = -1;
    let lastWeek = 0;
    header.forEach((c, j) => {
      let w = weekOf(clean(c));
      // settimana ripetuta per sbaglio («6 SETT.», «6 SETT.», «6 SETT.»): è la successiva
      if (w !== null && j > 0 && w <= lastWeek && cols[w] !== undefined) w = lastWeek + 1;
      if (w !== null && j > 0) { cols[w] = j; lastWeek = w; }
      else if (/^note/i.test(clean(c))) noteCol = j;
    });
    if (Object.keys(cols).length === 0) {
      warnings.push(`${clean(header[0])}: non trovo le colonne delle settimane ("1 SETT.", "2 SETT."…), lo salto.`);
      return;
    }
    Object.assign(weekCols, cols);

    const next = di + 1 < dayStarts.length ? dayStarts[di + 1] : rows.length;
    const exercises: ProgramExercise[] = [];
    const blocks: ProgramBlock[] = [];
    let block: ProgramBlock | null = null;
    let section: { type: SectionType; rest: number | null; warm: string; weeks: Record<number, string> } | null = null;

    for (let i = start + 1; i < next; i++) {
      const r = rows[i];
      const c0 = cell(r, 0);
      if (!filled(r)) continue;
      if (!c0) {
        // riga senza nome con solo prescrizioni nelle settimane («2x8/10» in ogni colonna): nuova sezione senza titolo
        const vals = Object.values(cols).map((j) => cell(r, j)).filter(Boolean);
        if (vals.length && vals.every(hasSetsTimesReps)) {
          const sectionWeeks: Record<number, string> = {};
          Object.entries(cols).forEach(([w, j]) => { const v = cleanCell(cell(r, j)); if (v) sectionWeeks[Number(w)] = v; });
          section = { type: 'progressione', rest: (section as { rest: number | null } | null)?.rest ?? null, warm: '', weeks: sectionWeeks };
          block = null;
        }
        continue;
      }
      if (GUIDE_RE.test(c0)) {
        guidelinesStart = Math.min(guidelinesStart, i);
        break;
      }
      const hasWeeks = Object.values(cols).some((j) => cell(r, j) !== '');
      // intestazione di blocco: "AMRAP 12'", "For Time (cap 15')", "5 RFT", "Circuito x3"; la durata può stare nelle colonne
      const firstWeek = Object.values(cols).map((j) => cell(r, j)).find(Boolean) ?? '';
      const blockHead = !isSectionLabel(c0) && !isBareLabel(c0) ? parseBlockHeader(/\d/.test(c0) || !firstWeek ? c0 : `${c0} ${firstWeek}`) : null;
      if (blockHead) {
        block = { id: `b-${di + 1}-${blocks.length + 1}`, ...blockHead, title: sentenceCase(c0) };
        blocks.push(block);
        section = null;
        continue;
      }
      if (isSectionLabel(c0) || (isBareLabel(c0) && !hasWeeks && nextHasWeeks(rows, i, next, cols))) {
        // le prescrizioni per settimana stanno sulla riga di intestazione e valgono per gli esercizi sotto
        const sectionWeeks: Record<number, string> = {};
        Object.entries(cols).forEach(([w, j]) => { const v = cleanCell(cell(r, j)); if (v) sectionWeeks[Number(w)] = v; });
        section = { type: sectionTypeOf(c0), rest: restFrom(c0), warm: noteCol >= 0 ? cell(r, noteCol) : '', weeks: sectionWeeks };
        block = null;
        continue;
      }
      if (isBareLabel(c0)) {
        guidelinesStart = Math.min(guidelinesStart, i);
        break;
      }
      if (!hasWeeks && cell(r, 1) === '' && !section && !block) continue; // riga di testo isolata

      if (block) {
        // esercizio del blocco: la quantità è com'è scritta, il recupero lo decide il formato
        const qty: Record<number, string> = {};
        Object.entries(cols).forEach(([w, j]) => { const v = blockCell(cell(r, j)); if (v) qty[Number(w)] = v; });
        const note = noteCol >= 0 ? cell(r, noteCol) : '';
        exercises.push({
          id: `ex-${di + 1}-${exercises.length + 1}`,
          name: sentenceCase(c0),
          note: note ? capFirst(sentenceCase(note)) : undefined,
          sectionType: 'progressione',
          restTimeSec: 0,
          weeks: qty,
          blockId: block.id,
          sheetRow: i + 1
        });
        continue;
      }

      // prescrizione scritta sulla riga dell'esercizio (es. addome 4xMAX), se c'è
      const own: Record<number, string> = {};
      // sotto una sezione con le prescrizioni conta solo ciò che ha «x», MAX, tempo o distanza: il resto («9-7», «11/10/8…») è scritto dall'atleta
      const sectionHasWeeks = !!section && Object.keys(section.weeks).length > 0;
      Object.entries(cols).forEach(([w, j]) => { const v = cleanCell(cell(r, j)); if (v && (!sectionHasWeeks || hasSetsTimesReps(v) || looksLikeActivityText(v))) own[Number(w)] = v; });
      const ownValues = Object.values(own);
      const ownIsMax = ownValues.length > 0 && ownValues.every((v) => /max/i.test(v));
      const inherits = ownValues.length === 0 && !!section && Object.keys(section.weeks).length > 0;
      const weeks: Record<number, string> = inherits ? { ...section!.weeks } : own;
      const values = Object.values(weeks);
      const inferred: SectionType = values.length && values.every((v) => /max/i.test(v)) ? 'core' : values.length && values.every((v) => /^\d+\s*-\s*\d+/.test(v)) ? 'cedimento' : 'progressione';
      const type: SectionType = ownIsMax ? 'core' : section?.type ?? inferred;
      const usesSection = !ownIsMax && !!section;
      const note = noteCol >= 0 ? cell(r, noteCol) : '';
      exercises.push({
        id: `ex-${di + 1}-${exercises.length + 1}`,
        name: sentenceCase(c0),
        note: note ? capFirst(sentenceCase(note)) : undefined,
        warmupNote: usesSection && section?.warm ? capFirst(sentenceCase(section.warm)) : undefined,
        sectionType: type,
        // il recupero scritto nella cella («4x8 rec 90"») vale più di quello della sezione
        restTimeSec: (values.length ? parsePrescription(values[0]).restSec : undefined) ?? (usesSection ? section?.rest ?? 120 : type === 'core' ? 90 : 120),
        weeks,
        cellMode: inherits ? 'loads' : undefined,
        sheetRow: i + 1
      });
    }

    if (!exercises.length) warnings.push(`${clean(header[0])}: nessun esercizio trovato.`);
    const num = clean(header[0]).match(DAY_RE)?.[2] ?? String(di + 1);
    days.push({ id: `giorno-${num.toLowerCase()}`, title: sentenceCase(clean(header[0])), exercises, ...(blocks.length ? { blocks } : {}) });
  });

  // Indicazioni finali
  const guide: string[] = [];
  let progressione = '';
  let cedimento = '';
  let mode: 'mod' | 'prog' | 'ced' = 'mod';
  for (let i = guidelinesStart; i < rows.length; i++) {
    const c0 = cell(rows[i], 0);
    if (!c0) continue;
    if (GUIDE_RE.test(c0)) { mode = 'mod'; continue; }
    if (isBareLabel(c0)) { mode = /^cedim/i.test(c0) ? 'ced' : 'prog'; continue; }
    const line = capFirst(sentenceCase(c0));
    if (mode === 'mod') guide.push(line);
    else if (mode === 'prog') progressione = progressione ? `${progressione} ${line}` : line;
    else cedimento = cedimento ? `${cedimento} ${line}` : line;
  }

  const exerciseCount = days.reduce((n, d) => n + d.exercises.length, 0);
  if (exerciseCount === 0) throw new Error('Ho trovato i giorni ma nessun esercizio. Il formato del foglio è diverso da quello che conosco.');

  const totalWeeks = Math.max(...Object.keys(weekCols).map(Number));
  return {
    exerciseCount,
    warnings,
    program: {
      title,
      athlete,
      trainer,
      totalWeeks: Math.min(16, Math.max(1, totalWeeks)),
      days,
      guidelines: { modalitaEsecuzione: guide, progressione, cedimento },
      source: { tab, weekCols, annotate: true }
    }
  };
}

function nextHasWeeks(rows: string[][], from: number, end: number, cols: Record<number, number>): boolean {
  for (let i = from + 1; i < end; i++) {
    const r = rows[i] ?? [];
    if (!(r ?? []).some((c) => clean(c) !== '')) continue;
    return Object.values(cols).some((j) => clean(r[j]) !== '');
  }
  return false;
}

/**
 * Dopo aver riletto il foglio, mantiene gli id e i collegamenti alla libreria
 * degli esercizi già presenti (stesso nome), così lo storico resta agganciato.
 */
export function mergeWithPrevious(next: WorkoutProgram, previous: WorkoutProgram): WorkoutProgram {
  const key = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  const old = new Map(previous.days.flatMap((d) => d.exercises).map((e) => [key(e.name), e]));

  // prima gli esercizi riconosciuti, poi si assegnano id nuovi che non collidono
  const used = new Set<string>();
  const matched = next.days.map((d) =>
    d.exercises.map((e) => {
      const prev = old.get(key(e.name));
      if (prev && !used.has(prev.id)) {
        used.add(prev.id);
        return { ...e, id: prev.id, libraryId: e.libraryId ?? prev.libraryId, linkedBy: e.libraryId ? e.linkedBy : prev.linkedBy, fresh: false };
      }
      return { ...e, fresh: true };
    })
  );
  let counter = 0;
  return {
    ...next,
    days: next.days.map((d, di) => ({
      ...d,
      exercises: matched[di].map(({ fresh, ...e }) => {
        if (!fresh) return e;
        let id = e.id;
        while (used.has(id)) id = `ex-n${++counter}`;
        used.add(id);
        return { ...e, id };
      })
    }))
  };
}
