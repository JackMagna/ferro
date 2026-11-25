import { useMemo, useState } from 'react';
import type { FoodEntry, Measurement } from '../../types';
import { MAX_PER_SEND, SHORTCUT_FROM_HEALTH, SHORTCUT_GUIDE, SHORTCUT_LINKS, SHORTCUT_TO_HEALTH, pendingForApple, shortcutUrl } from '../../lib/appleHealthBridge';
import { readJSON, writeJSON } from '../../lib/storage';
import { Button } from '../ui/Button';
import { ExternalLink } from '../ui/icons';
import { useHealthConsent } from '../privacy/HealthConsent';

const SENT_KEY = 'irontrack:apple-sent';
const isIPhone = () => typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Apple Salute tramite Comandi rapidi: visibile solo su iPhone e iPad. */
export function AppleHealthPanel({ measurements, meals }: { measurements: Measurement[]; meals: FoodEntry[] }) {
  const [sent, setSent] = useState(() => new Set(readJSON<string[]>(SENT_KEY, [])));
  const consent = useHealthConsent();
  const pending = useMemo(() => pendingForApple(measurements, meals, sent), [measurements, meals, sent]);
  if (!isIPhone()) return null;

  const markSent = (keys: string[]) => {
    const next = new Set([...sent, ...keys]);
    writeJSON(SENT_KEY, [...next].slice(-5000));
    setSent(next);
  };
  const send = async () => {
    if (!pending.keys.length || !(await consent.ensure())) return;
    window.location.href = shortcutUrl(SHORTCUT_TO_HEALTH, JSON.stringify(pending.payload));
    markSent(pending.keys);
  };
  const resend = () => {
    if (!window.confirm('Rimandare a Salute tutti i dati? Quelli già registrati compariranno due volte in Salute.')) return;
    writeJSON(SENT_KEY, []);
    setSent(new Set());
  };
  const link = (url: string, label: string) => (
    <a href={url || SHORTCUT_GUIDE} target={url ? undefined : '_blank'} rel="noopener" className="inline-flex items-center gap-1 text-plate underline">
      {label}<ExternalLink className="h-3.5 w-3.5" />
    </a>
  );

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <h3 className="font-display text-lg font-semibold">Apple Salute</h3>
      <p className="text-sm text-muted">
        Su iPhone Ferro passa i dati a Salute con due Comandi rapidi: pesate, massa grassa, calorie e macro dei pasti verso Salute; le pesate di Salute verso Ferro.
        Aggiungili una volta: {link(SHORTCUT_LINKS.toHealth, `«${SHORTCUT_TO_HEALTH}»`)} e {link(SHORTCUT_LINKS.fromHealth, `«${SHORTCUT_FROM_HEALTH}»`)}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!pending.keys.length} onClick={() => void send()}>
          {pending.keys.length ? `Invia a Salute (${pending.keys.length}${pending.total > pending.keys.length ? ` di ${pending.total}` : ''})` : 'Niente di nuovo da inviare'}
        </Button>
        <Button onClick={() => void consent.ensure().then((ok) => { if (ok) window.location.href = shortcutUrl(SHORTCUT_FROM_HEALTH); })}>Importa le pesate da Salute</Button>
      </div>
      <p className="text-xs text-faint">
        Si invia un massimo di {MAX_PER_SEND} valori alla volta: se ne restano, tocca di nuovo. Ferro segna come inviati i dati quando apre il Comando rapido.{' '}
        {sent.size > 0 && <button type="button" className="underline" onClick={resend}>Rimanda tutto</button>}
      </p>
    </section>
  );
}
