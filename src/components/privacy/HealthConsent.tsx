import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CONSENT_ASKED_KEY, hasValidConsent, newConsent, type HealthConsent } from '../../lib/consent';
import { readJSON, writeJSON } from '../../lib/storage';
import { PRIVACY_URL } from '../../lib/links';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';

export const NO_CONSENT_MESSAGE = 'Senza consenso non posso salvare questi dati. Scheda e allenamenti funzionano lo stesso.';

interface Api {
  /** true se c'è un consenso valido per la versione attuale del testo */
  valid: boolean;
  consent: HealthConsent | null;
  /** Chiede il consenso se manca. Risponde true se si può procedere a salvare dati sanitari. */
  ensure(): Promise<boolean>;
  /** Salva il consenso senza mostrare il pannello (es. casella già spuntata nella disclosure di Google Health). */
  grant(): void;
  revoke(): void;
  /** Avviso una sola volta per chi ha già dati sanitari salvati senza consenso. */
  askExistingOnce(): void;
}

export const HealthConsentContext = createContext<Api | null>(null);

export function useHealthConsent(): Api {
  const api = useContext(HealthConsentContext);
  if (!api) throw new Error('useHealthConsent va usato dentro HealthConsentProvider');
  return api;
}

interface Options {
  consent: HealthConsent | null;
  onSave: (c: HealthConsent | null) => void;
  onDeclined: (message: string) => void;
  /** elimina misure, pasti e dieta (dopo conferma) */
  onDeleteHealthData: () => void;
}

/** Testo del consenso: deve restare allineato a site/privacypolicy.html. */
export function ConsentText() {
  return (
    <div className="space-y-3 text-[15px]">
      <p>Peso, massa grassa, misure, frequenza cardiaca, pasti e dieta sono dati relativi alla salute. Per salvarli, Ferro ha bisogno del tuo consenso esplicito.</p>
      <ul className="space-y-2 pl-5 [list-style:disc]">
        <li><strong>Dove vanno.</strong> Sul tuo dispositivo. Con l'account Google, nel tuo spazio privato su Firebase (Europa), leggibile solo da te. Con i collegamenti che attivi tu, anche su Google Health, Health Connect o nel foglio del tuo coach.</li>
        <li><strong>A cosa servono.</strong> Solo a mostrarti i tuoi progressi nell'app. Niente pubblicità, niente cessione a terzi.</li>
        <li><strong>Sei libero.</strong> Puoi revocare il consenso quando vuoi da «Account e dati» e cancellare i tuoi dati.</li>
      </ul>
    </div>
  );
}

/** Casella del consenso: mai preselezionata. */
export function ConsentCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-ink p-3 text-[15px]">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-plate" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label ?? 'Acconsento al trattamento dei miei dati sulla salute come descritto nell\''}
        <a href={PRIVACY_URL} target="_blank" rel="noopener" className="text-plate underline">informativa</a>.
      </span>
    </label>
  );
}

/**
 * Logica del consenso più il pannello da mostrare. Si usa in App (prima di ogni ritorno anticipato)
 * e si passa l'api ai componenti con HealthConsentContext.Provider.
 */
export function useHealthConsentGate({ consent, onSave, onDeclined, onDeleteHealthData }: Options): { api: Api; sheet: ReactNode } {
  const valid = hasValidConsent(consent);
  const [mode, setMode] = useState<'closed' | 'ask' | 'existing'>('closed');
  const [checked, setChecked] = useState(false);
  const pending = useRef<((ok: boolean) => void)[]>([]);
  const validRef = useRef(valid);
  validRef.current = valid;

  const finish = (ok: boolean) => {
    const cbs = pending.current;
    pending.current = [];
    setMode('closed');
    setChecked(false);
    cbs.forEach((cb) => cb(ok));
  };

  const grant = useCallback(() => onSave(newConsent()), [onSave]);

  const ensure = useCallback((): Promise<boolean> => {
    if (validRef.current) return Promise.resolve(true);
    return new Promise((resolve) => {
      pending.current.push(resolve);
      setMode((m) => (m === 'closed' ? 'ask' : m));
    });
  }, []);

  const askExistingOnce = useCallback(() => {
    if (validRef.current || readJSON<boolean>(CONSENT_ASKED_KEY, false)) return;
    writeJSON(CONSENT_ASKED_KEY, true);
    setMode((m) => (m === 'closed' ? 'existing' : m));
  }, []);

  const accept = () => {
    grant();
    validRef.current = true;
    finish(true);
  };
  const decline = () => {
    finish(false);
    onDeclined(NO_CONSENT_MESSAGE);
  };

  const api: Api = { valid, consent, ensure, grant, revoke: () => onSave(null), askExistingOnce };

  const sheet = (
      <Sheet open={mode !== 'closed'} onClose={decline} title="I tuoi dati sulla salute">
        <div className="space-y-4">
          {mode === 'existing' && (
            <p className="rounded-xl border border-plate/50 bg-plate/10 p-3 text-sm">
              Hai già misure, pasti o una dieta salvati. Da ora Ferro chiede il consenso per i dati sulla salute: senza, quelli che hai restano visibili ma non se ne aggiungono altri e le sincronizzazioni si fermano.
            </p>
          )}
          <ConsentText />
          <ConsentCheckbox checked={checked} onChange={setChecked} />
          <div className="flex flex-wrap justify-end gap-2">
            {mode === 'existing' && (
              <Button variant="danger" className="mr-auto" onClick={() => { finish(false); onDeleteHealthData(); }}>Elimina i dati sanitari</Button>
            )}
            <Button onClick={decline}>Non ora</Button>
            <Button variant="primary" disabled={!checked} onClick={accept}>Acconsento</Button>
          </div>
        </div>
      </Sheet>
  );
  return { api, sheet };
}
