import { useEffect, useState } from 'react';
import { APK_URL, checkForUpdate } from '../../lib/appUpdate';
import { isAndroidApp } from '../../services/healthConnect';
import { Button } from '../ui/Button';
import { X } from '../ui/icons';
import { Logo } from './Logo';

/** App Android scaricata dal sito: all'apertura avvisa se è uscita una versione nuova. */
export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    const current = import.meta.env.VITE_APP_VERSION;
    if (!isAndroidApp() || !current) return;
    void checkForUpdate(current).then(setLatest);
  }, []);

  if (!latest) return null;
  return (
    <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-plate/50 bg-plate/10 p-3">
      <Logo className="h-7 w-7 shrink-0" />
      <p className="min-w-0 flex-1 text-[15px]">
        <span className="block font-semibold">Nuova versione di Ferro ({latest})</span>
        <span className="block text-sm text-muted">Scarica il file e aprilo: l'app si aggiorna e i dati restano.</span>
      </p>
      {/* nell'app Android i link esterni si aprono nel browser, che scarica l'APK */}
      <Button size="sm" variant="primary" onClick={() => { window.open(APK_URL, '_blank', 'noopener'); setLatest(null); }}>Aggiorna</Button>
      <button type="button" aria-label="Più tardi" className="-mr-1 rounded-lg p-1.5 text-muted hover:text-chalk" onClick={() => setLatest(null)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
