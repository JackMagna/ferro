import { useState } from 'react';
import { ClipboardList } from '../ui/icons';
import type { CoachWatch } from '../../hooks/useCoachSheetWatch';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { locale, t } from '../../lib/i18n';

/** Avviso in cima allo schermo quando il coach ha cambiato la scheda nel foglio. */
export function CoachUpdateBanner({ watch, trainer }: { watch: CoachWatch; trainer?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (watch.status !== 'changed' && !open) return null;

  const n = watch.changes.length;
  const who = trainer?.trim() || t('Il coach');
  const groups = watch.changes.reduce<Map<string, string[]>>((m, c) => m.set(c.day, [...(m.get(c.day) ?? []), c.text]), new Map());

  const apply = async () => {
    setBusy(true);
    try {
      await watch.apply();
      toast(t('Scheda aggiornata'));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {watch.status === 'changed' && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-plate/50 bg-plate/10 p-3">
          <ClipboardList className="h-6 w-6 shrink-0 text-plate" />
          <p className="min-w-0 flex-1 text-[15px]">
            <span className="block font-semibold">{t('{who} ha aggiornato la scheda', { who })}</span>
            <span className="block text-sm text-muted">{n === 1 ? t('1 modifica nel foglio') : t('{n} modifiche nel foglio', { n })}</span>
          </p>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>{t('Vedi')}</Button>
        </div>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('Modifiche nel foglio')}
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { watch.dismiss(); setOpen(false); }}>{t('Ignora')}</Button>
            <Button className="flex-1" variant="primary" disabled={busy} onClick={() => void apply()}>{busy ? t('Aggiorno…') : t('Aggiorna la scheda')}</Button>
          </div>
        }
      >
        <div className="space-y-4 text-[15px]">
          {[...groups].map(([day, lines]) => (
            <div key={day || '_'}>
              <h3 className="font-display text-lg font-semibold">{day || t('Generale')}</h3>
              <ul className="mt-1 space-y-1">
                {lines.map((l, i) => <li key={i} className="rounded-lg bg-ink px-3 py-1.5">{l}</li>)}
              </ul>
            </div>
          ))}
          <p className="text-sm text-muted">{t("Allenamenti e carichi già salvati restano. «Ignora» tiene la tua scheda com'è e non ti avvisa più per questa versione.")}</p>
        </div>
      </Sheet>
    </>
  );
}

/** Stato del controllo nel pannello del foglio, con il tasto per controllare a mano. */
export function CoachCheckRow({ watch }: { watch: CoachWatch }) {
  if (watch.status === 'idle') return null;
  const time = watch.checkedAt ? new Date(watch.checkedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  const text =
    watch.status === 'checking' ? t('Controllo il foglio…')
    : watch.status === 'uptodate' ? (time ? t('Scheda allineata al foglio (controllata alle {time}).', { time }) : t('Scheda allineata al foglio.'))
    : watch.status === 'changed' ? t("Il coach ha modificato la scheda: guarda l'avviso in alto.")
    : watch.status === 'error' ? watch.error || t('Controllo non riuscito.')
    : t('Ferro controlla da solo se il coach cambia la scheda mentre il permesso Google è attivo.');
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <span className="flex-1">{text}</span>
      {watch.status !== 'checking' && watch.status !== 'changed' && (
        <Button size="sm" onClick={() => void watch.check(true)}>{t('Controlla modifiche')}</Button>
      )}
    </div>
  );
}
