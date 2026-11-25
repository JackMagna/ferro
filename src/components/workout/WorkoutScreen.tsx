import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Heart } from '../ui/icons';
import { workoutNoticeState } from '../../lib/workoutNotice';
import { askWorkoutNotice, clearWorkoutNotice, showWorkoutNotice } from '../../services/workoutNotice';
import type { ProgramDay, SetLog, WorkoutProgram, WorkoutSession } from '../../types';
import { useLibrary } from '../../hooks/useLibrary';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isPersonalRecord, lastSetsFor, volumeOf } from '../../lib/stats';
import { formatKg, formatLoad, newId, todayISO } from '../../lib/ids';
import { getFeedback, sound, subscribeFeedback, unlockAudio, vibrate } from '../../lib/sound';
import type { HeartRateConnection } from '../../services/heartRate';
import { BONUS_DAY_ID, computeBonusDay } from '../../lib/bonusDay';
import { buildDraft, clearDraft, draftHasProgress, loadDraft, saveDraft, suggestNext, type WorkoutDraft } from './draft';
import { ExerciseList } from './ExerciseList';
import { SetLogger } from './SetLogger';
import { ActivityLogger, BlockResultCard } from './ActivityLogger';
import { describePlan, planFor } from '../../lib/activity';
import { ExerciseAside } from './ExerciseAside';
import { RestTimer } from './RestTimer';
import { HeartRateSheet } from './HeartRateSheet';
import { Segmented } from '../ui/Segmented';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../ui/Toast';
import { t } from '../../lib/i18n';

interface Props {
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  onFinish: (s: WorkoutSession) => void;
  onEditProgram: () => void;
  /** corregge la foto: collega l'esercizio (per nome, in tutta la scheda) a uno della libreria */
  onLinkExercise?: (name: string, libraryId: string | undefined, previous: string | undefined) => void;
}

export function WorkoutScreen({ program, sessions, onFinish, onEditProgram, onLinkExercise }: Props) {
  const toast = useToast();
  const { byId } = useLibrary();
  const wide = useMediaQuery('(min-width: 768px)');
  const xl = useMediaQuery('(min-width: 1280px)');

  // giorno bonus: esercizi saltati nei giorni precedenti della settimana (compare solo se ce ne sono)
  const bonus = useMemo(() => computeBonusDay(program, sessions), [program, sessions]);
  const days = useMemo(() => (bonus ? [...program.days, bonus.day] : program.days), [program.days, bonus]);
  const doneBefore = (dayId: string) => (dayId === BONUS_DAY_ID && bonus ? bonus.doneBefore : undefined);

  const [draft, setDraft] = useState<WorkoutDraft | null>(() => {
    const saved = loadDraft();
    return saved && days.some((d) => d.id === saved.dayId) ? saved : null;
  });
  const [pendingSwitch, setPendingSwitch] = useState<{ dayId: string; week: number } | null>(null);
  const [rest, setRest] = useState<{ key: number; seconds: number } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [hr, setHr] = useState<HeartRateConnection | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);

  // Prima apertura: prepara l'allenamento suggerito
  useEffect(() => {
    if (draft || program.days.length === 0) return;
    const next = suggestNext(program, sessions);
    const day = program.days.find((d) => d.id === next.dayId) ?? program.days[0];
    setDraft(buildDraft(day, Math.min(next.week, program.totalWeeks), sessions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, program]);

  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  // Le misure del cardio vanno nella bozza
  const hrRef = useRef(setDraft);
  hrRef.current = setDraft;
  const onBpm = (v: number) => {
    setBpm(v);
    if (v <= 0) return;
    hrRef.current((d) => (d && d.startedAt ? { ...d, hr: { sum: d.hr.sum + v, count: d.hr.count + 1, max: Math.max(d.hr.max, v) } } : d));
  };

  useEffect(() => {
    return () => hr?.disconnect();
  }, [hr]);

  const day: ProgramDay | undefined = days.find((d) => d.id === draft?.dayId) ?? program.days[0];

  // Se la scheda cambia (esercizi aggiunti o tolti) allinea la bozza
  useEffect(() => {
    if (!draft || !day) return;
    const missing = day.exercises.filter((e) => !draft.sets[e.id]);
    if (!missing.length) return;
    const fresh = buildDraft(day, draft.week, sessions, doneBefore(day.id));
    setDraft((d) => (d ? { ...d, sets: { ...fresh.sets, ...d.sets } } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const totals = useMemo(() => {
    const all = Object.entries(draft?.sets ?? {}).filter(([id]) => day?.exercises.some((e) => e.id === id));
    const sets = all.flatMap(([, l]) => l);
    const done = sets.filter((s) => s.completed);
    return { total: sets.length, done: done.length, volume: volumeOf(done) };
  }, [draft, day]);

  // Notifica dell'allenamento in corso (app Android): da quando si completa la prima serie fino a Concludi
  const feedback = useSyncExternalStore(subscribeFeedback, getFeedback);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  useEffect(() => {
    const ex = draft && day?.exercises[Math.min(draft.exIndex, day.exercises.length - 1)];
    if (!draft?.startedAt || !day || !ex) {
      void clearWorkoutNotice();
      return;
    }
    const list = draft.sets[ex.id] ?? [];
    void showWorkoutNotice(workoutNoticeState({
      dayTitle: day.title,
      exercise: ex,
      sets: list,
      setIndex: Math.min(draft.setIndex, Math.max(0, list.length - 1)),
      prescription: ex.weeks[draft.week],
      done: totals.done,
      total: totals.total,
      restEndAt: rest && restEnd ? restEnd : undefined,
      alert: feedback.sound || feedback.vibration
    }));
  }, [draft, day, totals, rest, restEnd, feedback]);

  if (!program.days.length || !day) {
    return (
      <EmptyState title={t('La scheda è vuota')} action={<Button variant="primary" onClick={onEditProgram}>{t('Apri la scheda')}</Button>}>
        {t('Aggiungi almeno un giorno con un esercizio per iniziare ad allenarti.')}
      </EmptyState>
    );
  }
  if (!draft) return null;
  if (!day.exercises.length) {
    return (
      <EmptyState title={t('{day} non ha esercizi', { day: day.title })} action={<Button variant="primary" onClick={onEditProgram}>{t('Aggiungi esercizi')}</Button>} />
    );
  }

  const exIndex = Math.min(draft.exIndex, day.exercises.length - 1);
  const exercise = day.exercises[exIndex];
  const sets = draft.sets[exercise.id] ?? [];
  const setIndex = Math.min(draft.setIndex, Math.max(0, sets.length - 1));
  // carico × ripetizioni, tenuta, cardio, nuoto, blocco o testo: decide la schermata, i record e il recupero
  const plan = planFor(exercise, draft.week);
  const block = exercise.blockId ? day.blocks?.find((b) => b.id === exercise.blockId) : undefined;

  const select = (dayId: string, week: number) => {
    // il bonus usa la settimana del programma degli allenamenti di questa settimana
    if (dayId === BONUS_DAY_ID && bonus && draft.dayId !== BONUS_DAY_ID) week = bonus.week;
    if (dayId === draft.dayId && week === draft.week) return;
    if (draftHasProgress(draft)) setPendingSwitch({ dayId, week });
    else switchTo(dayId, week);
  };
  const switchTo = (dayId: string, week: number) => {
    const target = days.find((d) => d.id === dayId) ?? day;
    setDraft(buildDraft(target, week, sessions, doneBefore(target.id)));
    setRest(null);
    setPendingSwitch(null);
  };

  const goTo = (i: number) => setDraft((d) => (d ? { ...d, exIndex: i, setIndex: firstOpen(d.sets[day.exercises[i].id] ?? []) } : d));

  const updateSet = (i: number, patch: Partial<SetLog>) =>
    setDraft((d) => {
      if (!d) return d;
      const list = [...(d.sets[exercise.id] ?? [])];
      list[i] = { ...list[i], ...patch };
      // un nuovo carico vale anche per le serie successive non ancora fatte
      if (patch.weightKg !== undefined) {
        for (let j = i + 1; j < list.length; j++) if (!list[j].completed) list[j] = { ...list[j], weightKg: patch.weightKg };
      }
      return { ...d, sets: { ...d.sets, [exercise.id]: list } };
    });

  const addSet = () =>
    setDraft((d) => {
      if (!d) return d;
      const list = d.sets[exercise.id] ?? [];
      const last = list[list.length - 1] ?? { weightKg: 20, reps: 10, completed: false };
      return { ...d, sets: { ...d.sets, [exercise.id]: [...list, { ...last, completed: false }] }, setIndex: list.length };
    });

  const complete = () => {
    unlockAudio();
    askWorkoutNotice();
    const current = sets[setIndex];
    if (!current) return;
    const wasDone = current.completed;
    const record = !wasDone && plan.kind === 'carico' && isPersonalRecord(sessions, exercise.id, exercise.name, current.weightKg, current.reps);
    if (record) toast(t('Record su {name}: {load} × {reps}', { name: exercise.name, load: `${formatLoad(current.weightKg)}\u00a0kg`, reps: current.reps }), 'record');
    sound.setDone();
    // serie registrata: un tocco breve; record: un colpo doppio, l'unico momento "espressivo"
    vibrate(record ? [30, 60, 30, 60, 90] : 20);
    setDraft((d) => {
      if (!d) return d;
      const list = [...(d.sets[exercise.id] ?? [])];
      list[setIndex] = { ...list[setIndex], completed: true };
      const nextOpen = list.findIndex((s, i) => i > setIndex && !s.completed);
      const allDone = list.every((s) => s.completed);
      const nextEx = allDone && exIndex < day.exercises.length - 1 ? exIndex + 1 : exIndex;
      return {
        ...d,
        startedAt: d.startedAt ?? Date.now(),
        sets: { ...d.sets, [exercise.id]: list },
        exIndex: wasDone ? d.exIndex : nextEx,
        setIndex: wasDone ? d.setIndex : nextEx !== exIndex ? firstOpen(d.sets[day.exercises[nextEx].id] ?? []) : nextOpen === -1 ? setIndex : nextOpen
      };
    });
    const withRest = plan.kind === 'carico' || plan.kind === 'tenuta';
    if (!wasDone && withRest && exercise.restTimeSec > 0) setRest({ key: Date.now(), seconds: exercise.restTimeSec });
  };

  const finish = () => {
    const endedAt = Date.now();
    // nel bonus le serie continuano la numerazione di quelle già fatte in settimana (foglio del coach)
    const offset = doneBefore(day.id) ?? {};
    const startedAt = draft.startedAt ?? endedAt;
    const entries = day.exercises.flatMap((ex) =>
      (draft.sets[ex.id] ?? [])
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.completed)
        .map(({ s, i }) => ({
          exerciseId: ex.id, exerciseName: ex.name, setIndex: i + (offset[ex.id] ?? 0), weightKg: s.weightKg, reps: s.reps,
          ...(s.durationSec ? { durationSec: s.durationSec } : {}),
          ...(s.distanceM ? { distanceM: s.distanceM } : {})
        }))
    );
    const blockResults = Object.values(draft.blockResults ?? {}).filter((b) => (day.blocks ?? []).some((x) => x.id === b.blockId));
    const session: WorkoutSession = {
      id: newId('s'),
      date: todayISO(),
      startedAt,
      endedAt,
      dayId: day.id,
      dayTitle: day.title,
      weekNumber: draft.week,
      durationMinutes: Math.max(1, Math.round((endedAt - startedAt) / 60000)),
      totalVolumeKg: volumeOf(entries),
      sets: entries,
      ...(blockResults.length ? { blockResults } : {}),
      avgBpm: draft.hr.count ? Math.round(draft.hr.sum / draft.hr.count) : undefined,
      maxBpm: draft.hr.max || undefined,
      sheetsSynced: false
    };
    onFinish(session);
    clearDraft();
    setRest(null);
    setFinishOpen(false);
    const next = suggestNext(program, [session, ...sessions]);
    const nextDay = program.days.find((d) => d.id === next.dayId) ?? program.days[0];
    setDraft(buildDraft(nextDay, next.week, [session, ...sessions]));
  };

  const weekOptions = Array.from({ length: program.totalWeeks }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const libraryEx = exercise.libraryId ? byId.get(exercise.libraryId) : undefined;
  const lastTime = lastSetsFor(sessions, exercise.id, exercise.name);

  return (
    <div className="space-y-4 pb-28 sm:space-y-5 lg:pb-24">
      {/* Giorno, settimana, cardio */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="sr-only">{t('Allenamento')}</h1>
          <Segmented label={t('Giorno')} value={draft.dayId} onChange={(id) => select(id, draft.week)} options={days.map((d) => ({ value: d.id, label: d.title }))} />
          {day.subtitle && <p className={day.id === BONUS_DAY_ID ? 'text-sm text-muted' : 'hidden text-sm text-muted sm:block'}>{day.subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <span className="shrink-0 text-sm text-muted">{t('Sett.')}</span>
            <Segmented label={t('Settimana')} value={draft.week} onChange={(w) => select(draft.dayId, w)} options={weekOptions} />
          </div>
          <button
            type="button"
            onClick={() => setHrOpen(true)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[15px] font-semibold ${hr ? 'border-stop/50 text-chalk' : 'border-line text-muted hover:text-chalk'}`}
            aria-label={hr ? t('Frequenza cardiaca {bpm} battiti al minuto', { bpm: bpm ?? '' }) : t('Collega sensore cardio')}
          >
            <Heart className={`h-4 w-4 ${hr ? 'text-stop' : ''}`} />
            {hr ? <span className="tabular-nums">{bpm ?? '–'}</span> : <span className="hidden sm:inline">{t('Battito')}</span>}
          </button>
        </div>
      </div>

      {!xl && <ExerciseList layout="row" exercises={day.exercises} sets={draft.sets} activeIndex={exIndex} onSelect={goTo} />}

      <div className={`grid gap-6 ${xl ? 'grid-cols-[15rem_minmax(0,1fr)_22rem]' : wide ? 'grid-cols-[minmax(0,1fr)_minmax(0,20rem)]' : 'grid-cols-1'}`}>
        {xl && <ExerciseList layout="column" exercises={day.exercises} sets={draft.sets} activeIndex={exIndex} onSelect={goTo} />}
        {plan.kind === 'carico' || plan.kind === 'tenuta' ? (
        <SetLogger
          holds={plan.kind === 'tenuta'}
          description={plan.kind === 'tenuta' ? describePlan(plan) : undefined}
          exercise={exercise}
          week={draft.week}
          sets={sets}
          setIndex={setIndex}
          lastTime={lastTime}
          position={t('{n} di {total}', { n: exIndex + 1, total: day.exercises.length })}
          restSlot={rest ? <RestTimer startKey={rest.key} seconds={rest.seconds} onEnd={setRestEnd} onClose={() => setRest(null)} /> : undefined}
          onSelectSet={(i) => setDraft((d) => (d ? { ...d, setIndex: i } : d))}
          onChange={updateSet}
          onComplete={complete}
          onAddSet={addSet}
          onPrev={exIndex > 0 ? () => goTo(exIndex - 1) : undefined}
          onNext={exIndex < day.exercises.length - 1 ? () => goTo(exIndex + 1) : undefined}
        />
        ) : (
          <ActivityLogger
            exercise={exercise}
            week={draft.week}
            plan={plan}
            set={sets[0]}
            lastTime={lastTime}
            position={t('{n} di {total}', { n: exIndex + 1, total: day.exercises.length })}
            onChange={(patch) => updateSet(0, patch)}
            onComplete={complete}
            onPrev={exIndex > 0 ? () => goTo(exIndex - 1) : undefined}
            onNext={exIndex < day.exercises.length - 1 ? () => goTo(exIndex + 1) : undefined}
            blockSlot={block ? (
              <BlockResultCard
                block={block}
                result={draft.blockResults?.[block.id]}
                onChange={(res) => setDraft((d) => (d ? { ...d, startedAt: d.startedAt ?? Date.now(), blockResults: { ...d.blockResults, [block.id]: res } } : d))}
              />
            ) : undefined}
          />
        )}
        <ExerciseAside exercise={libraryEx} name={exercise.name} collapsible={!wide} onLink={onLinkExercise && ((id) => onLinkExercise(exercise.name, id, exercise.libraryId))} />
      </div>

      {/* Barra di fine allenamento */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 border-t border-line bg-ink/95 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{t('{done} di {total} serie', { done: totals.done, total: totals.total })}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
              <div className="h-full bg-go transition-[width]" style={{ width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%` }} />
            </div>
          </div>
          <Button variant={totals.done ? 'success' : 'secondary'} disabled={!totals.done} onClick={() => setFinishOpen(true)}>
            {t('Concludi')}
          </Button>
        </div>
      </div>

      <HeartRateSheet
        open={hrOpen}
        onClose={() => setHrOpen(false)}
        bpm={bpm}
        connection={hr}
        onConnected={(c) => { setHr(c); toast(t('Collegato a {name}', { name: c.deviceName })); }}
        onBpm={onBpm}
        onDisconnected={() => { setHr(null); setBpm(null); }}
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={t('Concludi allenamento')}
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setFinishOpen(false)}>{t('Continua')}</Button>
            <Button className="flex-1" variant="success" onClick={finish}>{t('Salva allenamento')}</Button>
          </div>
        }
      >
        <dl className="grid grid-cols-3 gap-3">
          {[
            [t('Serie'), `${totals.done}/${totals.total}`],
            [t('Volume'), `${formatKg(totals.volume)} kg`],
            [t('Durata'), draft.startedAt ? `${Math.max(1, Math.round((Date.now() - draft.startedAt) / 60000))} min` : '—']
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-ink p-3">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="num font-display text-2xl font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[15px] text-muted">
          {t('{day}, settimana {week}. Le serie non completate non vengono salvate.', { day: day.title, week: draft.week })}
        </p>
        <Button variant="ghost" className="mt-3 text-stop" onClick={() => { clearDraft(); setFinishOpen(false); switchTo(day.id, draft.week); }}>
          {t('Annulla allenamento senza salvare')}
        </Button>
      </Sheet>

      <Sheet
        open={!!pendingSwitch}
        onClose={() => setPendingSwitch(null)}
        title={t('Cambiare allenamento?')}
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setPendingSwitch(null)}>{t('Resta qui')}</Button>
            <Button className="flex-1" variant="danger" onClick={() => pendingSwitch && switchTo(pendingSwitch.dayId, pendingSwitch.week)}>{t('Cambia e scarta')}</Button>
          </div>
        }
      >
        <p className="text-[15px] text-muted">{t('Hai già completato {n} serie. Se cambi giorno o settimana le perdi. Per tenerle, prima tocca Concludi.', { n: totals.done })}</p>
      </Sheet>
    </div>
  );
}

function firstOpen(list: SetLog[]): number {
  const i = list.findIndex((s) => !s.completed);
  return i === -1 ? 0 : i;
}
