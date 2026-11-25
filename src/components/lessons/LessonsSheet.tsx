import { useRef, useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Calendar, Pencil, Plus, Trash2, Upload } from '../ui/icons';
import { useToast } from '../ui/Toast';
import { setLessons, useLessons } from '../../hooks/useLessons';
import { isPast, lessonActivity, normalizeLesson, parseIcs, whenLabel, WEEKDAYS, type Lesson } from '../../lib/lessons';
import { downloadIcs, insertInPhoneCalendar, nativeCalendarAvailable, openGoogleCalendar } from '../../services/calendar';
import { newId, todayISO } from '../../lib/ids';

interface Props {
  open: boolean;
  onClose: () => void;
}

const same = (a: Lesson, b: Lesson) => a.title.toLowerCase() === b.title.toLowerCase() && a.time === b.time && a.weekday === b.weekday && a.date === b.date;

/** Lezioni e corsi fissi: elenco, modifica, import da .ics e «metti nel calendario». */
export function LessonsSheet({ open, onClose }: Props) {
  const toast = useToast();
  const lessons = useLessons();
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null);
  const [calendarFor, setCalendarFor] = useState<Lesson | null>(null);
  const [found, setFound] = useState<Lesson[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const past = lessons.filter((l) => isPast(l));

  const save = (l: Lesson) => {
    setLessons(lessons.some((x) => x.id === l.id) ? lessons.map((x) => (x.id === l.id ? l : x)) : [...lessons, l]);
    setEditing(null);
    toast('Lezione salvata');
  };
  const remove = (l: Lesson) => {
    if (!window.confirm(`Togliere «${l.title}» dalle lezioni? Dal calendario del telefono va tolta a parte.`)) return;
    setLessons(lessons.filter((x) => x.id !== l.id));
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const list = parseIcs(await file.text()).filter((l) => !lessons.some((x) => same(x, l)) && !isPast(l));
    if (!list.length) toast('Nel file non ci sono lezioni nuove da aggiungere.', 'error');
    else setFound(list);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (editing) return <LessonForm open={open} initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onSave={save} />;

  return (
    <>
      <Sheet
        open={open && !calendarFor && !found}
        onClose={onClose}
        title="Lezioni e corsi"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Importa .ics</Button>
            <Button className="flex-1" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>Aggiungi</Button>
          </div>
        }
      >
        <p className="text-[15px] text-muted">
          Pilates, spinning, nuoto: i corsi fissi della settimana, fuori dalla scheda. Li vedi in Allenamento il giorno giusto e li segni come fatti con un tocco.
          Restano solo su questo telefono: Ferro non legge il tuo calendario.
        </p>
        {lessons.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-ink p-4 text-[15px] text-muted">
            Nessuna lezione. Aggiungila a mano, oppure importa il file .ics che trovi nell'email di prenotazione.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {lessons.map((l) => (
              <li key={l.id} className={`flex items-center gap-2 rounded-2xl bg-ink p-3 ${isPast(l) ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.title}</p>
                  <p className="truncate text-sm text-muted">{[whenLabel(l), `${l.durationMin} min`, l.place].filter(Boolean).join(' · ')}</p>
                </div>
                <Button size="sm" variant="ghost" aria-label={`Metti ${l.title} nel calendario`} onClick={() => setCalendarFor(l)}><Calendar className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label={`Modifica ${l.title}`} onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" aria-label={`Togli ${l.title}`} onClick={() => remove(l)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <Button variant="ghost" className="mt-2" onClick={() => setLessons(lessons.filter((l) => !isPast(l)))}>
            Togli le lezioni passate ({past.length})
          </Button>
        )}
        {lessons.length > 1 && (
          <Button variant="ghost" className="mt-2" icon={<Calendar className="h-4 w-4" />} onClick={() => void downloadIcs(lessons.filter((l) => !isPast(l)))}>
            Tutte nel calendario (file .ics)
          </Button>
        )}
        <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" aria-label="File .ics" onChange={(e) => void readFile(e.target.files?.[0])} />
      </Sheet>

      <Sheet open={open && !!calendarFor} onClose={() => setCalendarFor(null)} title="Metti nel calendario">
        {calendarFor && (
          <div className="space-y-2">
            <p className="text-[15px] text-muted">
              «{calendarFor.title}», {whenLabel(calendarFor)}{calendarFor.weekday ? ', ogni settimana' : ''}. Si apre il calendario già compilato: controlli e salvi tu.
            </p>
            {nativeCalendarAvailable() && (
              <Button block variant="primary" onClick={() => { void insertInPhoneCalendar(calendarFor).catch((e) => toast(e instanceof Error ? e.message : String(e), 'error')); setCalendarFor(null); }}>
                Calendario del telefono
              </Button>
            )}
            <Button block onClick={() => { openGoogleCalendar(calendarFor); setCalendarFor(null); }}>Google Calendar</Button>
            <Button block onClick={() => { void downloadIcs([calendarFor]); setCalendarFor(null); }}>File .ics (iPhone, Outlook, altri)</Button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={open && !!found}
        onClose={() => setFound(null)}
        title="Lezioni trovate"
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setFound(null)}>Annulla</Button>
            <Button className="flex-1" variant="primary" onClick={() => { setLessons([...lessons, ...(found ?? [])]); const n = found?.length ?? 0; toast(n === 1 ? 'Aggiunta 1 lezione' : `Aggiunte ${n} lezioni`); setFound(null); }}>Aggiungi</Button>
          </div>
        }
      >
        <ul className="space-y-2">
          {(found ?? []).map((l) => (
            <li key={l.id} className="rounded-2xl bg-ink p-3">
              <p className="font-semibold">{l.title}</p>
              <p className="text-sm text-muted">{[whenLabel(l) + (l.weekday ? ', ogni settimana' : ''), `${l.durationMin} min`, l.place].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function LessonForm({ open, initial, onCancel, onSave }: { open: boolean; initial: Lesson | null; onCancel: () => void; onSave: (l: Lesson) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [once, setOnce] = useState(!!initial?.date);
  const [weekday, setWeekday] = useState(initial?.weekday ?? ((new Date().getDay() + 6) % 7) + 1);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? '18:30');
  const [duration, setDuration] = useState(String(initial?.durationMin ?? 60));
  const [place, setPlace] = useState(initial?.place ?? '');
  const [id] = useState(() => initial?.id ?? newId('l'));
  const lesson = normalizeLesson({
    id,
    title,
    ...(once ? { date } : { weekday }),
    time,
    durationMin: Number(duration),
    place,
    activity: initial && initial.title === title.trim() ? initial.activity : lessonActivity(title)
  });

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={initial ? 'Modifica lezione' : 'Nuova lezione'}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onCancel}>Annulla</Button>
          <Button className="flex-1" variant="primary" disabled={!lesson} onClick={() => lesson && onSave(lesson)}>Salva</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="l-title">Lezione</label>
          <input id="l-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Pilates reformer" maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="l-repeat">Quando</label>
            <select id="l-repeat" className="field" value={once ? 'once' : 'weekly'} onChange={(e) => setOnce(e.target.value === 'once')}>
              <option value="weekly">Ogni settimana</option>
              <option value="once">Una volta</option>
            </select>
          </div>
          {once ? (
            <div>
              <label className="label" htmlFor="l-date">Data</label>
              <input id="l-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="l-day">Giorno</label>
              <select id="l-day" className="field" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="l-time">Ora</label>
            <input id="l-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="l-duration">Durata (min)</label>
            <input id="l-duration" className="field" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="l-place">Dove (facoltativo)</label>
          <input id="l-place" className="field" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Es. Studio Pilates, sala 2" maxLength={120} />
        </div>
      </div>
    </Sheet>
  );
}
