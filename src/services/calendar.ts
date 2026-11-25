import { Capacitor, registerPlugin } from '@capacitor/core';
import { buildIcs, googleCalendarUrl, lessonTimes, recurRule, type Lesson } from '../lib/lessons';
import { downloadText } from '../lib/download';

/** Plugin nativo in native/android (FerroCalendarPlugin.java): apre il modulo «Nuovo evento» del telefono, senza permessi. */
interface FerroCalendarPlugin {
  insert(o: { title: string; begin: number; end: number; location?: string; rrule?: string }): Promise<void>;
}
const plugin = registerPlugin<FerroCalendarPlugin>('FerroCalendar');

export function nativeCalendarAvailable(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('FerroCalendar');
  } catch {
    return false;
  }
}

/** Android: modulo del calendario di sistema già compilato. */
export async function insertInPhoneCalendar(l: Lesson): Promise<void> {
  const { start, end } = lessonTimes(l);
  await plugin.insert({ title: l.title, begin: start.getTime(), end: end.getTime(), location: l.place, rrule: recurRule(l) });
}

/** Google Calendar nel browser (o nell'app di Google Calendar, se il telefono la apre). */
export function openGoogleCalendar(l: Lesson) {
  window.open(googleCalendarUrl(l), '_blank', 'noopener');
}

/** File .ics per iPhone, Outlook e gli altri calendari: si apre e si conferma l'importazione. */
export function downloadIcs(lessons: Lesson[]): Promise<void> {
  const name = lessons.length === 1 ? lessons[0].title : 'lezioni';
  const safe = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lezioni';
  return downloadText(`ferro-${safe}.ics`, buildIcs(lessons), 'text/calendar;charset=utf-8');
}
