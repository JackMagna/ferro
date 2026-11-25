/**
 * Lezioni e corsi fissi (pilates reformer il martedì alle 18:30, spinning il giovedì…), fuori dalla scheda del coach.
 * Restano solo su questo dispositivo: Ferro non legge il calendario del telefono.
 * - Si scrivono a mano o si importano da un file .ics (quello allegato all'email di prenotazione).
 * - Si mettono nel calendario senza permessi: link di Google Calendar, file .ics, modulo di sistema su Android.
 * - Una lezione fatta diventa un allenamento (dayId «lezione»), che non sposta la rotazione dei giorni della scheda.
 */
import type { WorkoutSession } from '../types';
import { activityOf, type Activity } from './activity';
import { newId, todayISO } from './ids';
import { readJSON, writeJSON } from './storage';

export interface Lesson {
  id: string;
  title: string;
  /** 1 = lunedì … 7 = domenica, per le lezioni settimanali */
  weekday?: number;
  /** AAAA-MM-GG, per una lezione singola (di solito importata da .ics) */
  date?: string;
  /** HH:MM, ora locale */
  time: string;
  durationMin: number;
  place?: string;
  activity: Activity;
}

export const LESSON_DAY_ID = 'lezione';
export const isLessonSession = (s: Pick<WorkoutSession, 'dayId'>) => s.dayId === LESSON_DAY_ID;
/** Attività registrata dall'orologio e importata da Health Connect (lib/watchImport.ts). */
export const WATCH_DAY_ID = 'orologio';
export const isWatchSession = (s: Pick<WorkoutSession, 'dayId'>) => s.dayId === WATCH_DAY_ID;
/** Sedute fuori dalla scheda (lezioni, orologio): non spostano la rotazione dei giorni né il giorno bonus. */
export const isOffProgramSession = (s: Pick<WorkoutSession, 'dayId'>) => isLessonSession(s) || isWatchSession(s);

export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const KEY = 'irontrack:lessons';

const pad = (n: number) => String(n).padStart(2, '0');
const validTime = (t: unknown): t is string => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) < 24 && Number(t.slice(3)) < 60;

/** Pulisce una lezione letta da localStorage o da un file: quelle senza titolo, ora o giorno vengono scartate. */
export function normalizeLesson(raw: unknown): Lesson | null {
  const l = raw as Partial<Lesson> | null;
  if (!l || typeof l.title !== 'string' || !l.title.trim() || !validTime(l.time)) return null;
  const weekday = Number.isInteger(l.weekday) && l.weekday! >= 1 && l.weekday! <= 7 ? l.weekday : undefined;
  const date = typeof l.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.date) ? l.date : undefined;
  if (!weekday && !date) return null;
  const title = l.title.trim().slice(0, 80);
  return {
    id: typeof l.id === 'string' && l.id ? l.id : newId('l'),
    title,
    ...(date ? { date } : { weekday }),
    time: l.time,
    durationMin: Math.min(600, Math.max(5, Math.round(Number(l.durationMin) || 60))),
    ...(typeof l.place === 'string' && l.place.trim() ? { place: l.place.trim().slice(0, 120) } : {}),
    activity: typeof l.activity === 'string' ? l.activity : lessonActivity(title)
  };
}

/** Disciplina dal titolo: «Spinning» è bici, «Yoga» è mobilità; i corsi di gruppo senza parola chiave restano «altro». */
export function lessonActivity(title: string): Activity {
  const a = activityOf(title);
  return a === 'forza' && !/pesi|palestra|(?:^|\s)gym|forza|functional|funzionale|crossfit|wod|hyrox|circuito|pump|tonificazione|gag|total body/i.test(title) ? 'altro' : a;
}

export function loadLessons(): Lesson[] {
  const raw = readJSON<unknown[]>(KEY, []);
  return (Array.isArray(raw) ? raw : []).map(normalizeLesson).filter((l): l is Lesson => !!l);
}

export function saveLessons(list: Lesson[]) {
  writeJSON(KEY, list);
}

/* ---------- date e orari ---------- */

const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 1 = lunedì … 7 = domenica */
export const weekdayOf = (dateISO: string) => ((new Date(`${dateISO}T12:00:00`).getDay() + 6) % 7) + 1;

export function startOf(lesson: Lesson, dateISO: string): Date {
  return new Date(`${dateISO}T${lesson.time}:00`);
}

export function occursOn(lesson: Lesson, dateISO: string): boolean {
  return lesson.date ? lesson.date === dateISO : lesson.weekday === weekdayOf(dateISO);
}

export interface Occurrence {
  lesson: Lesson;
  date: string;
  start: Date;
  end: Date;
}

/** Lezioni del giorno, in ordine di ora. */
export function lessonsOn(lessons: Lesson[], dateISO: string): Occurrence[] {
  return lessons
    .filter((l) => occursOn(l, dateISO))
    .map((l) => {
      const start = startOf(l, dateISO);
      return { lesson: l, date: dateISO, start, end: new Date(start.getTime() + l.durationMin * 60_000) };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Prossime lezioni da adesso (comprese quelle in corso), entro i giorni indicati. */
export function upcoming(lessons: Lesson[], now = new Date(), days = 7): Occurrence[] {
  const out: Occurrence[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(...lessonsOn(lessons, isoOf(d)).filter((o) => o.end > now));
  }
  return out;
}

/** Lezioni singole già passate: si possono togliere. */
export const isPast = (l: Lesson, today = todayISO()) => !!l.date && l.date < today;

/** «Martedì 18:30» oppure «mar 10 nov, 18:30» */
export function whenLabel(l: Lesson): string {
  if (l.date) {
    const d = new Date(`${l.date}T12:00:00`);
    return `${d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}, ${l.time}`;
  }
  return `${WEEKDAYS[(l.weekday ?? 1) - 1]} ${l.time}`;
}

/* ---------- lezione fatta → allenamento ---------- */

export function lessonSession(o: Occurrence, sessions: WorkoutSession[]): WorkoutSession {
  const lastWeek = sessions.find((s) => !isOffProgramSession(s))?.weekNumber ?? 1;
  return {
    id: newId('s'),
    date: o.date,
    startedAt: o.start.getTime(),
    endedAt: o.end.getTime(),
    dayId: LESSON_DAY_ID,
    dayTitle: o.lesson.title,
    weekNumber: lastWeek,
    durationMinutes: o.lesson.durationMin,
    totalVolumeKg: 0,
    sets: []
  };
}

/** C'è già un allenamento registrato per questa lezione (stesso giorno e titolo)? */
export const lessonDone = (o: Occurrence, sessions: WorkoutSession[]) =>
  sessions.some((s) => isLessonSession(s) && s.date === o.date && s.dayTitle === o.lesson.title);

/* ---------- import da file .ics ---------- */

/** Toglie gli «a capo» del formato (righe che continuano con uno spazio) e le sequenze di escape. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
const unescapeText = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** «20261110T183000Z», «20261110T183000», «20261110» → data locale */
function icsDate(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

function icsDuration(value: string): number | undefined {
  const m = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Lezioni da un file .ics. Gli eventi settimanali (RRULE:FREQ=WEEKLY con un solo giorno) diventano lezioni fisse,
 * gli altri lezioni singole. Gli orari con fuso (TZID) si prendono come ora locale: va bene finché il fuso è quello del telefono.
 * Si tengono solo titolo, ora, durata e luogo: descrizione e invitati non si leggono.
 */
export function parseIcs(text: string): Lesson[] {
  const lessons: Lesson[] = [];
  let ev: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) ev = {};
    else if (line.startsWith('END:VEVENT')) {
      if (ev) {
        const l = eventToLesson(ev);
        if (l) lessons.push(l);
      }
      ev = null;
    } else if (ev) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const name = line.slice(0, i).split(';')[0].toUpperCase();
      if (['SUMMARY', 'DTSTART', 'DTEND', 'DURATION', 'LOCATION', 'RRULE', 'STATUS'].includes(name) && !(name in ev)) ev[name] = line.slice(i + 1).trim();
    }
  }
  return lessons;
}

function eventToLesson(ev: Record<string, string>): Lesson | null {
  if (ev.STATUS?.toUpperCase() === 'CANCELLED') return null;
  const start = ev.DTSTART ? icsDate(ev.DTSTART) : null;
  const title = ev.SUMMARY ? unescapeText(ev.SUMMARY) : '';
  if (!start || !title || !/T/.test(ev.DTSTART)) return null; // gli eventi di tutto il giorno non sono lezioni
  const end = ev.DTEND ? icsDate(ev.DTEND) : null;
  const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : ev.DURATION ? icsDuration(ev.DURATION) : undefined;
  const rule = ev.RRULE?.toUpperCase() ?? '';
  const byDay = rule.match(/BYDAY=([A-Z,]+)/)?.[1].split(',') ?? [];
  const weekly = /FREQ=WEEKLY/.test(rule) && !/INTERVAL=([2-9]|\d{2})/.test(rule) && byDay.length <= 1;
  const weekday = weekly ? (byDay.length ? ICS_DAYS.indexOf(byDay[0]) + 1 : ((start.getDay() + 6) % 7) + 1) : undefined;
  return normalizeLesson({
    title,
    ...(weekly && weekday ? { weekday } : { date: isoOf(start) }),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    durationMin: minutes && minutes > 0 ? minutes : 60,
    place: ev.LOCATION ? unescapeText(ev.LOCATION) : undefined
  });
}

/* ---------- nel calendario, senza permessi ---------- */

/** Prima volta che la lezione cade, da oggi in poi (per una singola: la sua data). */
export function firstDate(l: Lesson, now = new Date()): string {
  if (l.date) return l.date;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (l.weekday === ((d.getDay() + 6) % 7) + 1) return isoOf(d);
  }
  return isoOf(now);
}

/** Ora locale «fluttuante» del formato iCalendar: il calendario la mette nel fuso del telefono. */
const floating = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
export const recurRule = (l: Lesson) => (l.weekday ? `FREQ=WEEKLY;BYDAY=${ICS_DAYS[l.weekday - 1]}` : undefined);

export function lessonTimes(l: Lesson, now = new Date()) {
  const start = startOf(l, firstDate(l, now));
  return { start, end: new Date(start.getTime() + l.durationMin * 60_000) };
}

/** File .ics con tutte le lezioni, ripetizione settimanale e avviso un'ora prima. L'UID resta lo stesso: reimportarlo aggiorna invece di duplicare. */
export function buildIcs(lessons: Lesson[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ferro//Lezioni//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const l of lessons) {
    const { start, end } = lessonTimes(l, now);
    const rule = recurRule(l);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${l.id}@ferro.app`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${floating(start)}`,
      `DTEND:${floating(end)}`,
      `SUMMARY:${escapeText(l.title)}`,
      ...(l.place ? [`LOCATION:${escapeText(l.place)}`] : []),
      ...(rule ? [`RRULE:${rule}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(l.title)}`, 'TRIGGER:-PT60M', 'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Link «Aggiungi a Google Calendar» (modulo precompilato, nessun accesso al calendario da parte di Ferro). */
export function googleCalendarUrl(l: Lesson, now = new Date()): string {
  const { start, end } = lessonTimes(l, now);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: l.title, dates: `${floating(start)}/${floating(end)}`, details: 'Da Ferro' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) params.set('ctz', tz);
  if (l.place) params.set('location', l.place);
  const rule = recurRule(l);
  if (rule) params.set('recur', `RRULE:${rule}`);
  return `https://calendar.google.com/calendar/render?${params}`;
}
