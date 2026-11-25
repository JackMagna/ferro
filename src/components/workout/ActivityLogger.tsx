import { useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from '../ui/icons';
import type { BlockResult, ProgramBlock, ProgramExercise, SetEntry, SetLog } from '../../types';
import { activityOf, describeBlock, describePlan, formatDistance, formatDuration, type ActivityPlan } from '../../lib/activity';
import { NumberStepper } from './NumberStepper';
import { Button } from '../ui/Button';
import { BlockTimer } from './BlockTimer';
import { timerPlan } from '../../lib/blockTimer';
import { t } from '../../lib/i18n';

const ACTIVITY_LABEL: Record<string, string> = {
  forza: t('Esercizio'), corsa: t('Corsa'), bici: t('Bici'), nuoto: t('Nuoto'), vogatore: t('Vogatore'), ellittica: t('Ellittica'),
  camminata: t('Camminata'), pilates: t('Pilates'), mobilita: t('Mobilità'), altro: t('Attività')
};

interface Props {
  exercise: ProgramExercise;
  week: number;
  plan: ActivityPlan;
  set: SetLog | undefined;
  lastTime: SetEntry[];
  position: string;
  onChange: (patch: Partial<SetLog>) => void;
  onComplete: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** risultato del blocco, se l'esercizio fa parte di un AMRAP, For Time… */
  blockSlot?: ReactNode;
}

/**
 * Diario per ciò che non è «carico × ripetizioni»: cardio a tempo o distanza, ripetute, nuoto, esercizi di un blocco,
 * righe non capite (si mostra il testo del coach). Una voce sola da segnare come fatta, con durata e distanza modificabili.
 */
export function ActivityLogger({ exercise, week, plan, set, lastTime, position, onChange, onComplete, onPrev, onNext, blockSlot }: Props) {
  const activity = exercise.activity ?? activityOf(exercise.name);
  const swim = activity === 'nuoto';
  const text = exercise.weeks[week] ?? '';
  const description = describePlan(plan);
  const withDistance = plan.kind === 'distanza' || plan.kind === 'nuoto' || (plan.kind === 'intervalli' && !!plan.workM);
  const withDuration = plan.kind === 'tempo' || plan.kind === 'distanza' || plan.kind === 'intervalli' || plan.kind === 'nuoto';
  const done = !!set?.completed;
  const last = lastTime[0];
  const lastText = last && (last.durationSec || last.distanceM)
    ? [last.durationSec ? formatDuration(last.durationSec) : '', last.distanceM ? formatDistance(last.distanceM) : ''].filter(Boolean).join(' · ')
    : null;

  return (
    <section aria-labelledby="exercise-title" className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{position}</span>
          <span aria-hidden="true">·</span>
          <span>{exercise.blockId ? t('Blocco') : ACTIVITY_LABEL[activity] ?? t('Attività')}</span>
        </div>
        <h2 id="exercise-title" className="font-display text-2xl font-bold leading-tight sm:text-4xl">{exercise.name}</h2>
        {text && <p className="whitespace-pre-line text-lg font-semibold text-plate">{text}</p>}
        {description && description !== text && <p className="text-[15px] text-muted">{description}</p>}
        {plan.kind === 'nuoto' && (
          <ol className="space-y-1 rounded-xl border border-line p-3 text-[15px]">
            {plan.parts.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        )}
        {exercise.note && <p className="text-[15px] text-chalk/90">{exercise.note}</p>}
        {lastText && <p className="text-sm text-muted">{t('Ultima volta:')} <span className="tabular-nums text-chalk/80">{lastText}</span></p>}
      </header>

      {blockSlot}

      {set && (
        <div className="space-y-3">
          {withDuration && (
            <NumberStepper
              label={t('Durata')} unit="min" value={Math.round((set.durationSec ?? 0) / 60)} steps={[1, 5]}
              onChange={(v) => onChange({ durationSec: v * 60 })}
            />
          )}
          {withDistance && (swim ? (
            <NumberStepper label={t('Distanza')} unit="m" value={set.distanceM ?? 0} steps={[25, 100]} onChange={(v) => onChange({ distanceM: v })} />
          ) : (
            <NumberStepper
              label={t('Distanza')} unit="km" decimals value={Math.round(((set.distanceM ?? 0) / 1000) * 100) / 100} steps={[0.1, 1]}
              onChange={(v) => onChange({ distanceM: Math.round(v * 1000) })}
            />
          ))}
          {plan.kind === 'intervalli' && (
            <NumberStepper label={t('Ripetute fatte')} unit={t('rip')} value={set.reps} steps={[1]} size="lg" onChange={(v) => onChange({ reps: v })} />
          )}
          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] z-20 -mx-4 bg-gradient-to-t from-ink from-70% to-transparent px-4 pb-1 pt-4 lg:bottom-[5.25rem]">
            <Button
              block
              size="lg"
              variant={done ? 'secondary' : 'primary'}
              icon={done ? <RotateCcw className="h-5 w-5" /> : <Check className="h-6 w-6" strokeWidth={3} />}
              onClick={onComplete}
              className="h-16 font-display text-xl shadow-lg shadow-black/40"
            >
              {done ? t('Fatto: aggiorna') : t('Fatto')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button className="flex-1" icon={<ChevronLeft className="h-5 w-5" />} disabled={!onPrev} onClick={onPrev}>{t('Precedente')}</Button>
        <Button className="flex-1" variant={done ? 'primary' : 'secondary'} disabled={!onNext} onClick={onNext}>
          {t('Successivo')} <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
}

/** Risultato di un blocco: giri + ripetizioni (AMRAP), tempo (For Time), ripetizioni (Tabata), RX o Scaled. */
export function BlockResultCard({ block, result, onChange }: { block: ProgramBlock; result: BlockResult | undefined; onChange: (r: BlockResult) => void }) {
  const kind = block.score ?? 'fatto';
  const r: BlockResult = result ?? { blockId: block.id, title: block.title ?? block.rawText ?? t('Blocco'), kind };
  const set = (patch: Partial<BlockResult>) => onChange({ ...r, ...patch });
  const [timer, setTimer] = useState(false);
  const hasTimer = timerPlan(block) !== null;
  const minutes = Math.floor((r.timeSec ?? 0) / 60);
  const seconds = (r.timeSec ?? 0) % 60;
  return (
    <div className="space-y-3 rounded-2xl border border-plate/40 bg-plate/5 p-4">
      <div>
        <p className="font-display text-lg font-bold">{block.title ?? t('Blocco')}</p>
        <p className="text-sm text-muted">{describeBlock(block)}</p>
      </div>
      {hasTimer && (timer
        ? <BlockTimer key={block.id} block={block} onResult={set} onClose={() => setTimer(false)} />
        : <Button variant="primary" block onClick={() => setTimer(true)}>{t('Avvia timer')}</Button>)}
      {kind === 'giri_rip' && (
        <div className="space-y-3">
          <NumberStepper label={t('Giri')} unit="" value={r.rounds ?? 0} steps={[1]} size="lg" onChange={(v) => set({ rounds: v })} />
          <NumberStepper label={t('Ripetizioni in più')} unit={t('rip')} value={r.reps ?? 0} steps={[1]} size="lg" onChange={(v) => set({ reps: v })} />
        </div>
      )}
      {kind === 'tempo' && (
        <div className="space-y-3">
          <NumberStepper label={t('Tempo')} unit="min" value={minutes} steps={[1]} size="lg" onChange={(v) => set({ timeSec: v * 60 + seconds })} />
          <NumberStepper label={t('Secondi')} unit="s" value={seconds} steps={[1, 10]} size="lg" onChange={(v) => set({ timeSec: minutes * 60 + Math.min(59, v) })} />
        </div>
      )}
      {kind === 'rip' && <NumberStepper label={t('Ripetizioni totali')} unit={t('rip')} value={r.reps ?? 0} steps={[1, 5]} size="lg" onChange={(v) => set({ reps: v })} />}
      <label className="flex items-center gap-3 text-[15px]">
        <input type="checkbox" className="h-5 w-5 accent-plate" checked={r.rx ?? false} onChange={(e) => set({ rx: e.target.checked })} />
        {t('RX: fatto come scritto (senza riduzioni)')}
      </label>
    </div>
  );
}
