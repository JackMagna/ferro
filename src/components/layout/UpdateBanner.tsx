import { useEffect, useState } from 'react';
import { APK_URL, apkUrlFor, checkForUpdate, isRelease, type AppUpdateInfo } from '../../lib/appUpdate';
import { readJSON, writeJSON } from '../../lib/storage';
import { isAndroidApp } from '../../services/healthConnect';
import { downloadAndInstall, openInstallSettings, scheduleUpdateCheck, type UpdaterStatus } from '../../services/appUpdater';
import { askWorkoutNotice } from '../../services/workoutNotice';
import { Button } from '../ui/Button';
import { X } from '../ui/icons';
import { Logo } from './Logo';
import { t } from '../../lib/i18n';

const ASKED = 'irontrack:updateNotifyAsked';

type Step =
  | { kind: 'offer' }
  | { kind: 'allow' }
  | { kind: 'download'; progress: number | null }
  | { kind: 'installing' }
  | { kind: 'error' };

/**
 * App Android scaricata dal sito: all'apertura avvisa se è uscita una versione nuova, con le novità.
 * «Aggiorna» scarica l'APK nell'app e apre l'installazione di Android (i dati restano).
 * Programma anche il controllo giornaliero con notifica (services/appUpdater.ts).
 * Nel file per Google Play il plugin è spento: lì aggiorna il Play Store e il banner non compare.
 */
export function UpdateBanner() {
  const [latest, setLatest] = useState<AppUpdateInfo | null>(null);
  const [updater, setUpdater] = useState<UpdaterStatus | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'offer' });

  useEffect(() => {
    const current = import.meta.env.VITE_APP_VERSION;
    if (!isAndroidApp() || !isRelease(current)) return;
    void scheduleUpdateCheck().then((s) => {
      setUpdater(s);
      // Play aggiorna da sé: niente banner né notifiche di Ferro
      if (s && !s.selfUpdating) return;
      // la notifica della versione nuova ha bisogno del permesso delle notifiche (Android 13+): si chiede una volta
      if (s && !readJSON<boolean>(ASKED, false)) {
        writeJSON(ASKED, true);
        askWorkoutNotice();
      }
      void checkForUpdate(current).then(setLatest);
    });
  }, []);

  if (!latest) return null;

  const openInBrowser = () => {
    // nell'app Android i link esterni si aprono nel browser, che scarica l'APK
    window.open(APK_URL, '_blank', 'noopener');
    setLatest(null);
  };

  const start = async (status: UpdaterStatus | null = updater) => {
    if (!status?.selfUpdating) return openInBrowser();
    if (!status.canInstall) return setStep({ kind: 'allow' });
    setStep({ kind: 'download', progress: null });
    try {
      await downloadAndInstall(apkUrlFor(latest.tag), t('Ferro {v}', { v: latest.tag }), (progress) => setStep({ kind: 'download', progress }));
      setStep({ kind: 'installing' });
    } catch {
      setStep({ kind: 'error' });
    }
  };

  const allow = async () => {
    const s = await openInstallSettings();
    if (s) setUpdater(s);
    if (s?.canInstall) void start(s);
  };

  const busy = step.kind === 'download';
  let title = t('Nuova versione di Ferro ({v})', { v: latest.tag });
  let lines: string[] = latest.notes.length ? latest.notes : [t('Aggiorna per avere le ultime novità: i tuoi dati restano.')];
  let action = <Button size="sm" variant="primary" onClick={() => void start()}>{t('Aggiorna')}</Button>;

  if (step.kind === 'allow') {
    title = t('Consenti l’aggiornamento');
    lines = [t('Android chiede il permesso una volta sola: attiva «Consenti da questa fonte» per Ferro e torna qui.')];
    action = <Button size="sm" variant="primary" onClick={() => void allow()}>{t('Consenti')}</Button>;
  } else if (step.kind === 'download') {
    title = t('Download di Ferro {v}…', { v: latest.tag });
    lines = [step.progress == null ? t('Download in corso') : t('{p}% scaricato', { p: Math.round(step.progress * 100) })];
    action = <></>;
  } else if (step.kind === 'installing') {
    title = t('Installa l’aggiornamento');
    lines = [t('Nella finestra di Android premi «Aggiorna». Se l’hai chiusa, riprova da qui.')];
    action = <Button size="sm" variant="primary" onClick={() => void start()}>{t('Riprova')}</Button>;
  } else if (step.kind === 'error') {
    title = t('Aggiornamento non riuscito');
    lines = [t('Controlla la connessione e riprova, oppure scarica il file dal browser.')];
    action = (
      <span className="flex flex-col gap-1.5">
        <Button size="sm" variant="primary" onClick={() => void start()}>{t('Riprova')}</Button>
        <Button size="sm" variant="ghost" onClick={openInBrowser}>{t('Browser')}</Button>
      </span>
    );
  }

  return (
    <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-plate/50 bg-plate/10 p-3">
      <Logo className="h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 text-[15px]">
        <p className="font-semibold">{title}</p>
        {lines.map((l) => (
          <p key={l} className="text-sm text-muted">{l}</p>
        ))}
        {step.kind === 'download' && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-plate/20" aria-hidden>
            <div className="h-full rounded-full bg-plate transition-[width]" style={{ width: `${Math.round((step.progress ?? 0.05) * 100)}%` }} />
          </div>
        )}
      </div>
      {action}
      {!busy && (
        <button type="button" aria-label={t('Più tardi')} className="-mr-1 rounded-lg p-1.5 text-muted hover:text-chalk" onClick={() => setLatest(null)}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
