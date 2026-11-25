import { useRef } from 'react';
import { Download, LogIn, LogOut, Smartphone, Upload } from '../ui/icons';
import type { User } from 'firebase/auth';
import type { AppData } from '../../hooks/useAppData';
import { useInstallPrompt } from '../../hooks/usePWA';
import { downloadText } from '../../lib/download';
import { isAndroidApp } from '../../services/healthConnect';
import { todayISO } from '../../lib/ids';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { HealthPanel } from './HealthPanel';
import { AppearancePanel } from './AppearancePanel';
import { AppleHealthPanel } from './AppleHealthPanel';
import type { HealthApi } from '../../hooks/useHealthSync';
import { useHealthConsent } from '../privacy/HealthConsent';
import { consentDate } from '../../lib/consent';
import { LICENSES_URL, PRIVACY_URL } from '../../lib/links';

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  data: AppData;
  onLogin: () => void;
  onLogout: () => void;
  /** elimina l'account e tutti i dati (la conferma la chiede chi lo implementa) */
  onDeleteAccount: () => void;
  onImport: (raw: unknown) => void;
  health: HealthApi;
  /** elimina misure, pasti e dieta; con true non chiede conferma (già chiesta) */
  onDeleteHealthData: (confirmed?: boolean) => void;
}

export function AccountSheet({ open, onClose, user, data, onLogin, onLogout, onDeleteAccount, onImport, health, onDeleteHealthData }: Props) {
  const consent = useHealthConsent();
  const revoke = () => {
    if (!window.confirm('Revocare il consenso ai dati sulla salute? Ferro scollega Google Health e Health Connect e non salva più misure, pasti e dieta.')) return;
    consent.revoke();
    health.disconnect();
    health.setSource('none');
    if (window.confirm('Vuoi eliminare anche i dati sanitari già salvati (misure, pasti e dieta)?\n\nOK: sì, eliminali · Annulla: no, tienili')) onDeleteHealthData(true);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const { canInstall, installed, isIOS, install } = useInstallPrompt();

  const exportBackup = () => {
    // il consenso non va nel backup: si dà nell'app, non si importa da un file
    const { ready: _ready, consent: _consent, ...rest } = data;
    void downloadText(`irontrack-backup-${todayISO()}.json`, JSON.stringify({ app: 'irontrack', version: 2, ...rest }, null, 2), 'application/json');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Account e dati">
      <div className="space-y-6 text-[15px]">
        <section className="space-y-3">
          {user ? (
            <>
              <p>
                Connesso come <strong>{user.displayName || user.email}</strong>
                {user.email && user.displayName && <span className="block text-sm text-muted">{user.email}</span>}
              </p>
              <p className="text-sm text-muted">I dati sono salvati nel cloud e sincronizzati tra i tuoi dispositivi.</p>
              <Button icon={<LogOut className="h-4 w-4" />} onClick={onLogout}>Esci</Button>
              <div className="space-y-2 border-t border-line pt-4">
                <p className="text-sm text-muted">Eliminando l'account cancelli per sempre scheda, allenamenti, misure, pasti e dieta, dal cloud e da questo dispositivo.</p>
                <Button variant="danger" onClick={onDeleteAccount}>Elimina account e dati</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted">Stai usando l'app senza account: i dati sono solo su questo dispositivo.</p>
              <Button variant="primary" icon={<LogIn className="h-4 w-4" />} onClick={onLogin}>Accedi con Google</Button>
            </>
          )}
        </section>

        <AppearancePanel />

        <HealthPanel health={health} />

        <AppleHealthPanel measurements={data.measurements} meals={data.meals} />

        {consent.valid && consent.consent && (
          <section className="space-y-3 border-t border-line pt-5">
            <h3 className="font-display text-lg font-semibold">Consenso sui dati sanitari</h3>
            <p className="text-sm text-muted">Dato il {consentDate(consent.consent)}. Serve per salvare misure, pasti, dieta e dati di Google Health, Health Connect e Apple Salute.</p>
            <Button variant="danger" onClick={revoke}>Revoca il consenso</Button>
          </section>
        )}

        <section className="space-y-3 border-t border-line pt-5">
          <h3 className="font-display text-lg font-semibold">Backup</h3>
          <p className="text-sm text-muted">Un file con scheda, allenamenti e misure. Puoi reimportarlo su un altro dispositivo.</p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download className="h-4 w-4" />} onClick={exportBackup}>Esporta backup</Button>
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Importa backup</Button>
            <input
              ref={fileRef}
              type="file"
              // nell'app Android il selettore di file non riconosce sempre i .json: lì si mostrano tutti i file
              accept={isAndroidApp() ? undefined : 'application/json,.json'}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  onImport(JSON.parse(await file.text()));
                } catch {
                  onImport(null);
                }
              }}
            />
          </div>
        </section>

        <div className="space-y-2 border-t border-line pt-4 text-sm text-faint">
          <p>Versione dell'app: {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'sviluppo'}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={PRIVACY_URL} target="_blank" rel="noopener" className="underline">Informativa sulla privacy</a>
            <a href={LICENSES_URL} target="_blank" rel="noopener" className="underline">Licenze e crediti</a>
          </p>
        </div>

        {!installed && (
          <section className="space-y-3 border-t border-line pt-5">
            <h3 className="font-display text-lg font-semibold">Installa l'app</h3>
            {canInstall ? (
              <Button icon={<Smartphone className="h-4 w-4" />} onClick={install}>Installa sul dispositivo</Button>
            ) : isIOS ? (
              <p className="text-muted">Su iPhone: in Safari tocca Condividi, poi “Aggiungi alla schermata Home”.</p>
            ) : (
              <p className="text-muted">Dal menu del browser scegli “Installa app” o “Aggiungi a schermata Home”.</p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
