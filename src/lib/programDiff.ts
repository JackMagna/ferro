import type { ProgramDay, ProgramExercise, WorkoutProgram } from '../types';
import { t } from './i18n';

/**
 * Confronto tra la scheda in Ferro e quella appena riletta dal foglio del coach.
 * Si confrontano solo i campi che scrive il coach (nomi, serie per settimana, note, recuperi):
 * collegamenti alla libreria, id e righe del foglio non contano.
 */

const key = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const txt = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function weeksOf(e: ProgramExercise): Record<number, string> {
  const out: Record<number, string> = {};
  Object.entries(e.weeks).forEach(([w, v]) => { if (txt(v)) out[Number(w)] = txt(v).toUpperCase(); });
  return out;
}

/** Impronta della scheda letta dal foglio: se non cambia, il coach non ha toccato niente. */
export function programFingerprint(p: WorkoutProgram): string {
  const shape = {
    t: txt(p.title), a: txt(p.athlete), c: txt(p.trainer), w: p.totalWeeks,
    g: [p.guidelines.modalitaEsecuzione.map(txt), txt(p.guidelines.progressione), txt(p.guidelines.cedimento)],
    d: p.days.map((d) => [txt(d.title), d.exercises.map((e) => [txt(e.name), weeksOf(e), txt(e.note), txt(e.warmupNote), e.restTimeSec])])
  };
  const s = JSON.stringify(shape);
  // FNV-1a a 32 bit, due passate con semi diversi: basta a riconoscere un cambiamento
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

export interface ProgramChange {
  /** giorno a cui si riferisce, vuoto per le modifiche generali */
  day: string;
  text: string;
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function diffExercise(a: ProgramExercise, b: ProgramExercise, totalWeeks: number): string[] {
  const out: string[] = [];
  const wa = weeksOf(a);
  const wb = weeksOf(b);
  const weeks = [...new Set([...Object.keys(wa), ...Object.keys(wb)].map(Number))].filter((w) => w <= totalWeeks).sort((x, y) => x - y);
  const changed = weeks.filter((w) => (wa[w] ?? '') !== (wb[w] ?? ''));
  if (changed.length > 3) out.push(t('{name}: serie cambiate in {n} settimane', { name: b.name, n: changed.length }));
  else changed.forEach((w) => out.push(t('{name}, sett. {w}: {from} → {to}', { name: b.name, w, from: wa[w] || '—', to: wb[w] || '—' })));
  if (txt(a.note) !== txt(b.note)) out.push(txt(b.note) ? t('{name}: nota «{note}»', { name: b.name, note: short(txt(b.note)) }) : t('{name}: nota tolta', { name: b.name }));
  if (txt(a.warmupNote) !== txt(b.warmupNote)) out.push(t('{name}: riscaldamento cambiato', { name: b.name }));
  if (a.restTimeSec !== b.restTimeSec) out.push(t('{name}: recupero {from} → {to} s', { name: b.name, from: a.restTimeSec, to: b.restTimeSec }));
  return out;
}

function diffDay(a: ProgramDay, b: ProgramDay, totalWeeks: number): string[] {
  const out: string[] = [];
  const oldBy = new Map(a.exercises.map((e) => [key(e.name), e]));
  const newKeys = new Set(b.exercises.map((e) => key(e.name)));
  for (const e of b.exercises) {
    const prev = oldBy.get(key(e.name));
    if (!prev) out.push(t('Nuovo: {name}', { name: `${e.name}${e.weeks[1] ? ` (${e.weeks[1]})` : ''}` }));
    else out.push(...diffExercise(prev, e, totalWeeks));
  }
  a.exercises.filter((e) => !newKeys.has(key(e.name))).forEach((e) => out.push(t('Tolto: {name}', { name: e.name })));
  const common = (list: ProgramExercise[], other: Set<string>) => list.map((e) => key(e.name)).filter((k) => other.has(k));
  const orderA = common(a.exercises, newKeys);
  const orderB = common(b.exercises, new Set(oldBy.keys()));
  if (orderA.join('|') !== orderB.join('|')) out.push(t('Ordine degli esercizi cambiato'));
  return out;
}

/** Elenco leggibile delle differenze, da mostrare prima di aggiornare. */
export function diffPrograms(current: WorkoutProgram, next: WorkoutProgram): ProgramChange[] {
  const changes: ProgramChange[] = [];
  const general = (text: string) => changes.push({ day: '', text });
  if (txt(current.title) !== txt(next.title)) general(t('Titolo: {title}', { title: next.title }));
  if (current.totalWeeks !== next.totalWeeks) general(t('Settimane: {from} → {to}', { from: current.totalWeeks, to: next.totalWeeks }));
  const g = (p: WorkoutProgram) => JSON.stringify([p.guidelines.modalitaEsecuzione.map(txt), txt(p.guidelines.progressione), txt(p.guidelines.cedimento)]);
  if (g(current) !== g(next)) general(t('Indicazioni generali cambiate'));

  const used = new Set<ProgramDay>();
  const findOld = (d: ProgramDay) => current.days.find((o) => !used.has(o) && key(o.title) === key(d.title)) ?? current.days.find((o) => !used.has(o) && o.id === d.id);
  for (const d of next.days) {
    const prev = findOld(d);
    if (!prev) {
      changes.push({ day: d.title, text: t('Giorno nuovo con {n} esercizi', { n: d.exercises.length }) });
      continue;
    }
    used.add(prev);
    diffDay(prev, d, next.totalWeeks).forEach((text) => changes.push({ day: d.title, text }));
  }
  current.days.filter((d) => !used.has(d)).forEach((d) => changes.push({ day: d.title, text: t('Giorno tolto') }));
  return changes;
}
