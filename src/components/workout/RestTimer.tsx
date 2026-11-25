import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from '../ui/icons';
import { sound, vibrate } from '../../lib/sound';
import { openExactAlarmSettings, workoutNoticeStatus } from '../../services/workoutNotice';
import { t } from '../../lib/i18n';

interface Props {
  /** cambia a ogni serie completata: riavvia il timer */
  startKey: number;
  seconds: number;
  onClose: () => void;
  /** ora di fine (ms), anche dopo +30s / −15s: serve alla notifica dell'allenamento */
  onEnd?: (endAt: number) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Timer di recupero basato sull'orario di fine, così resta preciso anche se
 * il telefono mette in pausa la pagina mentre è bloccato.
 */
export function RestTimer({ startKey, seconds, onClose, onEnd }: Props) {
  const [startAt, setStartAt] = useState(() => Date.now());
  const [endAt, setEndAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(Date.now());
  const done = useRef(false);
  const lastTick = useRef<number | null>(null);
  // App Android: se mancano i permessi, a schermo bloccato l'avviso non arriva (o arriva tardi) e va detto
  const [notice, setNotice] = useState<{ granted: boolean; exact: boolean } | null>(null);
  useEffect(() => {
    void workoutNoticeStatus().then(setNotice);
  }, [startKey]);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    endRef.current?.(endAt);
  }, [endAt]);

  useEffect(() => {
    const t = Date.now();
    setStartAt(t);
    setEndAt(t + seconds * 1000);
    setNow(t);
    done.current = false;
  }, [startKey, seconds]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Schermo acceso durante il recupero (dove il browser lo permette); si riprende se la pagina torna visibile.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      try {
        if (active && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* non concesso (batteria scarica, browser non supportato): il timer funziona lo stesso */
      }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [startKey]);

  const left = Math.max(0, Math.ceil((endAt - now) / 1000));
  const finished = left === 0;

  useEffect(() => {
    if (finished && !done.current) {
      done.current = true;
      // a schermo bloccato la pagina è ferma: allo sblocco non suona in ritardo (ci ha già pensato la notifica)
      if (Date.now() - endAt < 3000) {
        sound.restOver();
        vibrate([300, 150, 300]);
      }
    } else if (!finished && left <= 3 && lastTick.current !== left) {
      lastTick.current = left;
      sound.tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, left]);

  const span = endAt - startAt;
  const progress = span > 0 ? Math.min(1, Math.max(0, (now - startAt) / span)) : 1;

  return (
    <div role="timer" aria-live={finished ? 'assertive' : 'off'} className="mb-2">
      <div className={`overflow-hidden rounded-2xl border shadow-2xl ${finished ? 'border-plate bg-plate-soft' : 'border-line bg-raised'}`}>
        <div className="h-1 bg-ink">
          <div className="h-full bg-plate transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2 pl-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{finished ? t('Recupero finito. Torna sotto.') : left <= 10 ? t('Preparati') : t('Recupero')}</p>
            <p className={`num-live font-display text-4xl font-bold leading-none ${finished || left <= 10 ? 'text-plate' : ''}`}>{fmt(left)}</p>
          </div>
          <button type="button" onClick={() => setEndAt((e) => Math.max(Date.now(), e - 15000))} aria-label={t('Togli 15 secondi')} className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-chalk">
            <Minus className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setEndAt((e) => Math.max(Date.now(), e) + 30000)} aria-label={t('Aggiungi 30 secondi')} className="inline-flex h-12 items-center gap-1 rounded-xl bg-ink px-3 font-semibold text-chalk">
            <Plus className="h-4 w-4" />30s
          </button>
          <button type="button" onClick={onClose} aria-label={t('Chiudi timer')} className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-muted hover:text-chalk">
            <X className="h-5 w-5" />
          </button>
        </div>
        {notice && !notice.granted && (
          <p className="border-t border-line px-4 py-2 text-xs text-muted">{t('Notifiche di Ferro disattivate: a schermo bloccato la fine del recupero non suona. Attivale nelle impostazioni di Android.')}</p>
        )}
        {notice?.granted && !notice.exact && (
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            {t("A schermo bloccato l'avviso può arrivare in ritardo.")}{' '}
            <button type="button" className="font-semibold text-plate underline" onClick={() => void openExactAlarmSettings()}>{t('Consenti «Sveglie e promemoria»')}</button>
          </p>
        )}
      </div>
    </div>
  );
}
