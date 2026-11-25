import { useState } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from '../ui/icons';
import type { MeasuresState } from '../../hooks/useSheetsSync';
import type { MeasureConflict } from '../../lib/measuresSheet';
import { FIELD_UNIT } from '../../lib/measuresSheet';
import { locale, t } from '../../lib/i18n';
import { fieldLabel } from './MeasurementForm';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

interface Props {
  connected: boolean;
  loggedIn: boolean;
  pending: number;
  state: MeasuresState;
  onSync: (interactive: boolean) => void;
  onResolve: (c: MeasureConflict, choice: 'sheet' | 'app') => void;
}

const fmt = (n: number) => String(n).replace('.', ',');

/** Stato del collegamento tra le misure dell'app e la scheda MISURE del foglio. */
export function MeasuresSyncBar({ connected, loggedIn, pending, state, onSync, onResolve }: Props) {
  const [open, setOpen] = useState(false);
  if (!loggedIn || !connected) {
    return (
      <p className="rounded-xl border border-line p-3 text-sm text-muted">
        <CloudOff className="mr-1.5 inline h-4 w-4 align-text-bottom" />
        {t('Le misure restano su questo dispositivo. Per scriverle nel foglio del coach, accedi con Google e collega il foglio dalla sezione Scheda.')}
      </p>
    );
  }
  const conflicts = state.conflicts.length;
  const tone = state.status === 'error' || state.status === 'auth' ? 'border-stop/40 bg-stop/10' : conflicts ? 'border-plate/50 bg-plate/10' : 'border-line bg-panel';
  const label =
    state.status === 'syncing' ? t('Sincronizzo con il foglio…')
    : state.status === 'auth' ? t('Serve ricollegare Google per sincronizzare')
    : state.status === 'error' ? t('Sincronizzazione non riuscita')
    : conflicts ? conflicts === 1 ? t('1 valore diverso tra app e foglio') : t('{n} valori diversi tra app e foglio', { n: conflicts })
    : pending ? t('{n} da inviare al foglio', { n: pending })
    : state.status === 'ok' ? t('Sincronizzato con il foglio')
    : t('Foglio collegato');

  return (
    <div className={`space-y-2 rounded-xl border p-3 ${tone}`} role="status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {conflicts || state.status === 'error' || state.status === 'auth'
          ? <TriangleAlert className="h-5 w-5 shrink-0 text-plate" />
          : <CheckCircle2 className={`h-5 w-5 shrink-0 ${state.status === 'ok' && !pending ? 'text-go' : 'text-muted'}`} />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          {state.at && <p className="text-sm text-muted">{t('Ultimo controllo: {ora}', { ora: new Date(state.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</p>}
        </div>
        {conflicts > 0 && <Button size="sm" variant="primary" onClick={() => setOpen(true)}>{t('Risolvi')}</Button>}
        <Button size="sm" disabled={state.status === 'syncing'} icon={<RefreshCw className={`h-4 w-4 ${state.status === 'syncing' ? 'animate-spin' : ''}`} />} onClick={() => onSync(true)}>
          {state.status === 'auth' ? t('Ricollega Google') : t('Sincronizza')}
        </Button>
      </div>
      {state.message && <p className="text-sm text-muted">{state.message}</p>}

      <Sheet open={open && conflicts > 0} onClose={() => setOpen(false)} title={t('Valori diversi')} size="lg">
        <p className="mb-4 text-[15px] text-muted">{t("Per queste misure il foglio e l'app hanno numeri diversi. Scegli quale tenere: l'altro viene aggiornato.")}</p>
        <ul className="space-y-3">
          {state.conflicts.map((c) => (
            <li key={`${c.week}-${c.field}`} className="rounded-2xl bg-ink p-3">
              <p className="font-semibold">{t('{misura}, settimana {n}', { misura: fieldLabel(c.field), n: c.week })}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button onClick={() => onResolve(c, 'sheet')}>{t('Foglio: {v}', { v: `${fmt(c.sheetValue)} ${FIELD_UNIT[c.field]}` })}</Button>
                <Button onClick={() => onResolve(c, 'app')}>{t('App: {v}', { v: `${fmt(c.appValue)} ${FIELD_UNIT[c.field]}` })}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
