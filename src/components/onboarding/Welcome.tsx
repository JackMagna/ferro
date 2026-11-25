import { Logo } from '../layout/Logo';
import { Button } from '../ui/Button';
import { LICENSES_URL, PRIVACY_URL } from '../../lib/links';
import { authLog, authLogText } from '../../lib/authProbe';

interface Props {
  onLogin: () => void;
  onGuest: () => void;
  busy: boolean;
}

export function Welcome({ onLogin, onGuest, busy }: Props) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Logo className="h-14 w-14" />
        <h1 className="mt-6 font-display text-5xl font-bold leading-none">Ferro</h1>
        <p className="mt-3 text-lg text-muted">
          La tua scheda in palestra: serie, carichi, recuperi e progressi. Funziona anche senza rete.
        </p>

        <div className="mt-8 space-y-3">
          <Button block size="lg" variant="primary" disabled={busy} onClick={onLogin}>
            {busy ? 'Accesso in corso…' : 'Accedi con Google'}
          </Button>
          <Button block size="lg" onClick={onGuest}>Usa senza account</Button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-faint">
          Con Google i dati sono salvati nel cloud e li ritrovi su ogni dispositivo. Senza account restano solo su questo telefono; puoi accedere in seguito e verranno caricati.
        </p>
        <p className="mt-4 text-sm text-faint">
          Ferro è per chi ha almeno 14 anni.{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener" className="underline">Informativa</a> ·{' '}
          <a href={LICENSES_URL} target="_blank" rel="noopener" className="underline">Licenze</a>
        </p>
        <AuthLogDetails />
      </div>
    </div>
  );
}

/** Registro degli ultimi avvii: aiuta a capire perché l'app ha chiesto di nuovo l'accesso. */
function AuthLogDetails() {
  const log = authLog();
  if (!log.length) return null;
  const text = authLogText(log);
  return (
    <details className="mt-6 text-xs text-faint">
      <summary className="cursor-pointer">Ti chiede sempre l'accesso? Dettagli tecnici</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line p-3 font-mono">{text}</pre>
      <button type="button" className="mt-2 underline" onClick={() => void navigator.clipboard?.writeText(text)}>Copia</button>
    </details>
  );
}
