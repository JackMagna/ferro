import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlockResult, ProgramBlock } from '../../types';
import { formatClock, plannedSec, timerPlan, timerState, type TimerPhase } from '../../lib/blockTimer';
import { sound, unlockAudio, vibrate } from '../../lib/sound';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';

interface Props {
  block: ProgramBlock;
  /** a fine blocco: tempo (For Time) o giri (AMRAP) da mettere nel risultato */
  onResult: (patch: Partial<BlockResult>) => void;
  onClose: () => void;
}

const LABEL: Record<TimerPhase, string> = { pronti: t('Pronti'), lavoro: t('Via'), recupero: t('Recupero'), fine: t('Fatto') };

/** Schermo acceso mentre il timer gira (dove il browser lo permette). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let on = true;
    const request = async () => {
      try {
        if (on && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* non concesso: il timer funziona lo stesso */
      }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      on = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/**
 * Timer del blocco: 10 secondi di «pronti», poi lavoro e recuperi con i bip.
 * AMRAP: «+1 giro» a ogni giro finito. For Time: «Fine» quando hai chiuso.
 */
export function BlockTimer({ block, onResult, onClose }: Props) {
  const plan = useMemo(() => timerPlan(block), [block]);
  const [startAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [laps, setLaps] = useState(0);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const last = useRef({ index: -1, left: -1, ended: false });

  const frozen = stoppedAt ?? pausedAt;
  const elapsedMs = (frozen ?? now) - startAt - pausedMs;
  const state = plan ? timerState(plan, elapsedMs) : null;
  const ended = !!state && (state.phase === 'fine' || stoppedAt !== null);
  const running = !ended && pausedAt === null;

  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);

  // bip: ultimi 3 secondi di ogni fase, cambio fase, fine
  useEffect(() => {
    if (!state) return;
    const l = last.current;
    if (state.phase === 'fine') {
      if (!l.ended) {
        l.ended = true;
        sound.restOver();
        vibrate([300, 150, 300]);
        if (block.format === 'amrap') onResult({ rounds: laps });
        if (plan?.countUp && plan.capSec) onResult({ timeSec: plan.capSec });
      }
      return;
    }
    if (state.index !== l.index) {
      if (l.index >= 0) {
        if (state.phase === 'recupero') { sound.setDone(); vibrate(200); } else { sound.restOver(); vibrate([200, 100, 200]); }
      }
      l.index = state.index;
    } else if (state.left !== undefined && state.left <= 3 && state.left !== l.left && running) {
      sound.tick();
    }
    l.left = state.left ?? -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.index, state?.left, state?.phase]);

  if (!plan || !state) return null;

  const pause = () => { unlockAudio(); setPausedAt(Date.now()); };
  const resume = () => {
    unlockAudio();
    if (pausedAt !== null) setPausedMs((p) => p + Date.now() - pausedAt);
    setPausedAt(null);
  };
  const finish = () => {
    const t = Date.now();
    setStoppedAt(t);
    if (plan.countUp && block.format !== 'amrap') onResult({ timeSec: Math.max(1, Math.round((t - startAt - pausedMs - plan.leadSec * 1000) / 1000)) });
    if (block.format === 'amrap') onResult({ rounds: laps });
  };

  // a scendere per i blocchi a tempo fisso, a salire per il For Time (il valore resta fermo dopo «Fine»)
  const big = state.phase === 'pronti' || !plan.countUp ? state.left ?? 0 : state.elapsed;
  const total = plannedSec(plan);
  const showRounds = !plan.countUp && plan.rounds > 1;
  const tone = state.phase === 'recupero' ? 'border-line bg-ink' : state.phase === 'fine' ? 'border-plate bg-plate-soft' : 'border-plate bg-plate/10';

  return (
    <div role="timer" aria-label={t('Timer {name}', { name: block.title ?? t('blocco') })} className={`space-y-3 rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg font-bold" aria-live="polite">{ended ? LABEL.fine : pausedAt !== null ? t('In pausa') : LABEL[state.phase]}</p>
        {showRounds && state.phase !== 'pronti' && <p className="text-sm font-semibold tabular-nums">{t('{label} {n} di {total}', { label: plan.roundLabel, n: state.round, total: state.rounds })}</p>}
      </div>
      <p className={`num-live text-center font-display text-7xl font-bold leading-none ${state.phase === 'lavoro' && (state.left ?? 99) <= 3 ? 'text-plate' : ''}`}>
        {formatClock(big)}
      </p>
      {total !== undefined && state.phase !== 'pronti' && (
        <p className="text-center text-sm text-muted">{plan.countUp ? t('Limite {time}', { time: formatClock(total) }) : t('Passati {elapsed} di {total}', { elapsed: formatClock(state.elapsed), total: formatClock(total) })}</p>
      )}
      {block.format === 'amrap' && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" size="lg" disabled={ended || state.phase === 'pronti'} onClick={() => setLaps((n) => n + 1)}>{t('+1 giro')}</Button>
          <span className="text-lg font-semibold tabular-nums" aria-live="polite">{laps === 1 ? t('{n} giro', { n: laps }) : t('{n} giri', { n: laps })}</span>
          {laps > 0 && !ended && <Button size="sm" variant="ghost" onClick={() => setLaps((n) => Math.max(0, n - 1))}>−1</Button>}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {!ended && (pausedAt === null ? <Button onClick={pause}>{t('Pausa')}</Button> : <Button variant="primary" onClick={resume}>{t('Riprendi')}</Button>)}
        {!ended && (plan.countUp || block.format === 'amrap') && state.phase !== 'pronti' && <Button variant="primary" onClick={finish}>{t('Fine')}</Button>}
        <Button variant="ghost" onClick={onClose}>{ended ? t('Chiudi') : t('Annulla')}</Button>
      </div>
    </div>
  );
}
