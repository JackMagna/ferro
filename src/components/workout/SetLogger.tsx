import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from '../ui/icons';
import type { ProgramExercise, SetEntry, SetLog } from '../../types';
import { describePrescription, parsePrescription } from '../../lib/prescription';
import { formatLoad } from '../../lib/ids';
import { SECTION_LABELS } from '../../data/defaultProgram';
import { NumberStepper } from './NumberStepper';
import { WEIGHT_STEPS, decimalText, getWeightStep, setWeightStep, stepButtons } from '../../lib/weightStep';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';

interface Props {
  exercise: ProgramExercise;
  week: number;
  sets: SetLog[];
  setIndex: number;
  lastTime: SetEntry[];
  onSelectSet: (i: number) => void;
  onChange: (i: number, patch: Partial<SetLog>) => void;
  onComplete: () => void;
  onAddSet: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position: string;
  /** timer di recupero: sta sopra il pulsante, senza coprire nulla */
  restSlot?: ReactNode;
  /** tenute (plank, isometrie): secondi al posto delle ripetizioni */
  holds?: boolean;
  /** descrizione già pronta della prescrizione (per le tenute) */
  description?: string;
}

export function SetLogger({ exercise, week, sets, setIndex, lastTime, onSelectSet, onChange, onComplete, onAddSet, onPrev, onNext, position, restSlot, holds, description }: Props) {
  const current = sets[setIndex];
  // passo del carico di questo esercizio, ricordato sul dispositivo
  const [step, setStep] = useState(() => getWeightStep(exercise.name));
  useEffect(() => {
    setStep(getWeightStep(exercise.name));
  }, [exercise.name]);
  const prescription = exercise.weeks[week];
  const p = parsePrescription(prescription);
  const allDone = sets.length > 0 && sets.every((s) => s.completed);

  const amount = (s: { weightKg: number; reps: number; durationSec?: number }) =>
    holds ? `${s.weightKg ? `${formatLoad(s.weightKg)} kg · ` : ''}${s.durationSec ?? 0}"` : `${formatLoad(s.weightKg)}×${s.reps}`;
  const lastSummary = lastTime.length ? lastTime.map(amount).join('  ') : null;

  return (
    <section aria-labelledby="exercise-title" className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{position}</span>
          <span aria-hidden="true">·</span>
          <span>{SECTION_LABELS[exercise.sectionType]}</span>
          <span aria-hidden="true">·</span>
          <span>{t('Recupero {time}', { time: exercise.restTimeSec >= 60 ? `${Math.round((exercise.restTimeSec / 60) * 10) / 10} min` : `${exercise.restTimeSec} s` })}</span>
        </div>
        <h2 id="exercise-title" className="font-display text-2xl font-bold leading-tight sm:text-4xl">{exercise.name}</h2>
        <p className="text-lg">
          <span className="font-semibold text-plate">{prescription || '—'}</span>
          {prescription && <span className="text-muted"> ({description ?? describePrescription(prescription)})</span>}
        </p>
        {exercise.note && <p className="text-[15px] text-chalk/90">{exercise.note}</p>}
        {exercise.warmupNote && <p className="text-sm text-muted">{t('Prima: {note}', { note: exercise.warmupNote })}</p>}
        {lastSummary && <p className="text-sm text-muted">{t('Ultima volta:')} <span className="tabular-nums text-chalk/80">{lastSummary}</span></p>}
      </header>

      <div role="tablist" aria-label={t('Serie')} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {sets.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === setIndex}
            onClick={() => onSelectSet(i)}
            className={`flex h-14 min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border px-2 transition ${
              i === setIndex ? 'border-chalk bg-chalk text-ink' : s.completed ? 'border-go/50 text-go' : 'border-line text-muted'
            }`}
          >
            <span className="text-sm font-semibold">{t('Serie {n}', { n: i + 1 })}</span>
            <span className="text-xs tabular-nums">{s.completed ? amount(s) : holds ? `${s.durationSec ?? 0}"` : `${formatLoad(s.weightKg)} kg`}</span>
          </button>
        ))}
        <button type="button" onClick={onAddSet} className="h-14 shrink-0 rounded-xl border border-dashed border-line px-3 text-sm text-muted hover:text-chalk">
          {t('+ Serie')}
        </button>
      </div>

      {current && (
        <div className="space-y-3">
          <NumberStepper
            label={t('Carico, serie {n}', { n: setIndex + 1 })} unit="kg" value={current.weightKg} decimals steps={stepButtons(step)}
            onChange={(v) => onChange(setIndex, { weightKg: v })}
            extra={
              <label className="inline-flex h-8 items-center gap-1 text-sm text-muted">
                <span>{t('Passo')}</span>
                <select
                  value={step}
                  onChange={(e) => { const s = Number(e.target.value); setStep(s); setWeightStep(exercise.name, s); }}
                  className="h-8 rounded-lg border border-line bg-raised px-1.5 text-sm font-semibold text-chalk"
                  aria-label={t('Passo del carico per {name}', { name: exercise.name })}
                >
                  {WEIGHT_STEPS.map((s) => <option key={s} value={s}>{decimalText(s)} kg</option>)}
                </select>
              </label>
            }
          />
          {holds ? (
            <NumberStepper label={t('Secondi')} unit="s" value={current.durationSec ?? 0} min={1} steps={[5, 15]} size="lg" onChange={(v) => onChange(setIndex, { durationSec: v })} />
          ) : (
            <NumberStepper label={p.isMax ? t('Ripetizioni (al massimo)') : t('Ripetizioni')} unit={t('rip')} value={current.reps} min={1} steps={[1]} size="lg" onChange={(v) => onChange(setIndex, { reps: v })} />
          )}
          {/* Resta sempre visibile sopra le barre in basso mentre si scorre */}
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] z-20 -mx-4 bg-gradient-to-t from-ink from-70% to-transparent px-4 pb-1 pt-4 lg:bottom-[5.25rem]">
            {restSlot}
            <Button
              block
              size="lg"
              variant={current.completed ? 'secondary' : 'primary'}
              icon={current.completed ? <RotateCcw className="h-5 w-5" /> : <Check className="h-6 w-6" strokeWidth={3} />}
              onClick={onComplete}
              className="h-16 font-display text-xl shadow-lg shadow-black/40"
            >
              {current.completed ? t('Serie {n} fatta: aggiorna', { n: setIndex + 1 }) : t('Completa serie {n}', { n: setIndex + 1 })}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button className="flex-1" icon={<ChevronLeft className="h-5 w-5" />} disabled={!onPrev} onClick={onPrev}>{t('Precedente')}</Button>
        <Button className="flex-1" variant={allDone ? 'primary' : 'secondary'} disabled={!onNext} onClick={onNext}>
          {t('Successivo')} <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}
