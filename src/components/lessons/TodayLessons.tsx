import { useState } from 'react';
import type { WorkoutSession } from '../../types';
import { Button } from '../ui/Button';
import { Calendar, Check } from '../ui/icons';
import { useLessons } from '../../hooks/useLessons';
import { lessonDone, lessonSession, lessonsOn, upcoming } from '../../lib/lessons';
import { todayISO } from '../../lib/ids';
import { LessonsSheet } from './LessonsSheet';

interface Props {
  sessions: WorkoutSession[];
  onLog: (s: WorkoutSession) => void;
}

const hhmm = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

/** In Allenamento: le lezioni di oggi (con «Fatta») o la prossima. Senza lezioni non mostra niente. */
export function TodayLessons({ sessions, onLog }: Props) {
  const lessons = useLessons();
  const [open, setOpen] = useState(false);
  if (!lessons.length) return null;

  const today = lessonsOn(lessons, todayISO());
  const now = new Date();
  const next = today.length ? undefined : upcoming(lessons, now, 7)[0];

  return (
    <section className="card p-3 sm:p-4" aria-label="Lezioni">
      {today.length > 0 ? (
        <ul className="space-y-2">
          {today.map((o) => {
            const done = lessonDone(o, sessions);
            return (
              <li key={o.lesson.id} className="flex items-center gap-3">
                <Calendar className="h-5 w-5 shrink-0 text-plate" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{o.lesson.title}</p>
                  <p className="truncate text-sm text-muted">Oggi {hhmm(o.start)}–{hhmm(o.end)}{o.lesson.place ? ` · ${o.lesson.place}` : ''}</p>
                </div>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-go"><Check className="h-4 w-4" />Fatta</span>
                ) : (
                  <Button size="sm" variant={o.start <= now ? 'success' : 'secondary'} onClick={() => onLog(lessonSession(o, sessions))}>Fatta</Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(true)}>
          <Calendar className="h-5 w-5 shrink-0 text-muted" />
          <p className="min-w-0 flex-1 truncate text-[15px] text-muted">
            {next
              ? <>Prossima lezione: <span className="font-semibold text-chalk">{next.lesson.title}</span>, {next.start.toLocaleDateString('it-IT', { weekday: 'long' })} {hhmm(next.start)}</>
              : 'Nessuna lezione nei prossimi giorni'}
          </p>
        </button>
      )}
      {today.length > 0 && (
        <button type="button" className="mt-2 text-sm font-semibold text-muted hover:text-chalk" onClick={() => setOpen(true)}>Gestisci le lezioni</button>
      )}
      <LessonsSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

/** Nella Scheda: ingresso alle lezioni fisse. */
export function LessonsPanel() {
  const lessons = useLessons();
  const [open, setOpen] = useState(false);
  return (
    <section className="card flex flex-wrap items-center gap-3 p-4 sm:p-5">
      <Calendar className="h-6 w-6 shrink-0 text-plate" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold">Lezioni e corsi</h2>
        <p className="text-[15px] text-muted">
          {lessons.length ? `${lessons.length} ${lessons.length === 1 ? 'lezione' : 'lezioni'}: pilates, spinning, piscina e gli altri corsi fuori dalla scheda.` : 'Pilates, spinning, piscina: aggiungi i corsi fissi e mettili nel calendario.'}
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>{lessons.length ? 'Apri' : 'Aggiungi'}</Button>
      <LessonsSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
