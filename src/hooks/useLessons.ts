import { useSyncExternalStore } from 'react';
import { loadLessons, saveLessons, type Lesson } from '../lib/lessons';

/** Lezioni fisse, salvate solo su questo dispositivo e condivise tra le schermate che le mostrano. */
let current: Lesson[] | null = null;
const listeners = new Set<() => void>();

const get = () => (current ??= loadLessons());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setLessons(next: Lesson[]) {
  current = [...next].sort((a, b) => (a.date ?? `0${a.weekday}`).localeCompare(b.date ?? `0${b.weekday}`) || a.time.localeCompare(b.time));
  saveLessons(current);
  listeners.forEach((fn) => fn());
}

export function useLessons(): Lesson[] {
  return useSyncExternalStore(subscribe, get, get);
}
