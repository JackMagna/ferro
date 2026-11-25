import { useState } from 'react';
import { ExternalLink, RefreshCw, Scale } from '../ui/icons';
import { ConsentCheckbox, useHealthConsent } from '../privacy/HealthConsent';
import { GOOGLE_USER_DATA_POLICY } from '../../lib/links';
import type { HealthApi } from '../../hooks/useHealthSync';
import { isAndroidApp, openHealthConnectSettings } from '../../services/healthConnect';
import type { HealthSource } from '../../services/health';
import { Button } from '../ui/Button';

/**
 * Disclosure richiesta da Google per gli ambiti «restricted» della Google Health API:
 * deve dire esattamente cosa fa il codice (letture: fetchBody, fetchHeartRate; scritture: writeBody, logWorkout, writeMeal).
 */
function GoogleHealthDisclosure({ short = false }: { short?: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-ink p-3 text-sm">
      <p className="font-semibold text-chalk">Cosa fa Ferro con Google Health</p>
      {!short && <p>Quando colleghi Google Health, Ferro:</p>}
      <ul className="space-y-1 pl-5 [list-style:disc]">
        {!short && <li><strong>legge</strong> il tuo peso, la massa grassa e la frequenza cardiaca (negli ultimi 30 giorni, quando importi);</li>}
        <li><strong>scrive</strong> {short ? 'le calorie e i macronutrienti di ogni pasto che salvi, solo se attivi questa opzione' : 'le tue pesate, i tuoi allenamenti e, solo se lo attivi, i pasti (calorie e macronutrienti)'}.</li>
      </ul>
      <p><strong>Come li usa.</strong> Solo per mostrarti i tuoi progressi nell'app e tenere i dati allineati. Non li usa per pubblicità, non li vende e non li condivide con altri. I dati letti restano nel tuo spazio privato di Ferro e sul tuo dispositivo.</p>
      {!short && (
        <>
          <p>L'uso e il trasferimento delle informazioni ricevute dalle API di Google rispettano la <a href={GOOGLE_USER_DATA_POLICY} target="_blank" rel="noopener" className="text-plate underline">Google API Services User Data Policy</a>, compresi i requisiti di uso limitato.</p>
          <p>Puoi scollegare Google Health quando vuoi da qui, e revocare i permessi dal tuo account Google.</p>
        </>
      )}
    </div>
  );
}

function HealthConnectDisclosure() {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-ink p-3 text-sm">
      <p className="font-semibold text-chalk">Cosa fa Ferro con Health Connect</p>
      <ul className="space-y-1 pl-5 [list-style:disc]">
        <li><strong>legge</strong> peso, massa grassa, frequenza cardiaca e calorie bruciate con l'attività; solo quando tocchi «Importa dall'orologio», gli allenamenti delle ultime 2 settimane registrati da altre app, con la distanza;</li>
        <li><strong>scrive</strong> peso e massa grassa che inserisci in Ferro, gli allenamenti (tipo, durata, serie, volume e distanza) e, solo se lo attivi, le calorie dei pasti e l'acqua bevuta.</li>
      </ul>
      <p>Solo per mostrarti i tuoi progressi. Niente pubblicità, niente cessione a terzi. I permessi si gestiscono da Health Connect.</p>
    </div>
  );
}

const OPTIONS: { id: HealthSource; label: string; hint: string }[] = [
  { id: 'none', label: 'Nessuna', hint: 'Non collegare niente' },
  { id: 'googlehealth', label: 'Google Health', hint: 'Anche dal sito. Consigliata' },
  { id: 'healthconnect', label: 'Health Connect', hint: 'Solo nell\'app Android' }
];

/** Scelta della fonte dati salute: Google Health oppure Health Connect, una per volta. */
export function HealthPanel({ health }: { health: HealthApi }) {
  const android = isAndroidApp();
  const name = health.source === 'googlehealth' ? 'Google Health' : 'Health Connect';
  const consent = useHealthConsent();
  const [checked, setChecked] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  // Consenso e disclosure in un solo passaggio: la casella salva il consenso, poi si collega.
  const connect = () => {
    if (!consent.valid) {
      if (!checked) return;
      consent.grant();
    }
    void health.connect();
  };
  const importBody = async () => {
    if (await consent.ensure()) void health.importBody();
  };
  const canConnect = consent.valid || checked;

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <h3 className="font-display text-lg font-semibold">Dati salute</h3>
      <p className="text-sm text-muted">Scegli da dove importare peso, massa grassa e frequenza cardiaca. Le pesate che inserisci nell'app vengono inviate alla stessa fonte.</p>

      <div role="radiogroup" aria-label="Fonte dati salute" className="grid gap-2">
        {OPTIONS.map((o) => {
          // Google Health dall'app Android: Google rifiuta il token («disallowed OAuth scopes»), vedi nota sotto
          const disabled = (o.id === 'healthconnect' && !android) || (o.id === 'googlehealth' && android && health.source !== 'googlehealth');
          const active = health.source === o.id;
          return (
            <button
              key={o.id} type="button" role="radio" aria-checked={active} disabled={disabled}
              onClick={() => health.setSource(o.id)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left disabled:opacity-45 ${active ? 'border-plate bg-plate/10' : 'border-line'}`}
            >
              <span className="font-semibold">{o.label}</span>
              <span className="text-sm text-muted">{o.id === 'googlehealth' && android ? 'Solo dal sito' : disabled ? 'Serve l\'app Android' : o.hint}</span>
            </button>
          );
        })}
      </div>

      {health.source === 'googlehealth' && android && !health.connected && (
        <div role="status" className="space-y-2 rounded-xl border border-plate/50 bg-plate/10 p-3 text-sm">
          <p>
            Dall'app Android Google Health rifiuta il collegamento. Qui usa <strong>Health Connect</strong>: l'app Google Health (o Fitbit) del telefono
            legge da Health Connect, se nelle sue impostazioni è attiva la sincronizzazione. Dal sito Google Health funziona.
          </p>
          <Button size="sm" variant="primary" onClick={() => health.setSource('healthconnect')}>Passa a Health Connect</Button>
        </div>
      )}
      {health.source === 'googlehealth' && !android && !health.connected && (
        <div className="space-y-3 text-sm text-muted">
          <p>
            Usa lo stesso account Google con cui accedi. Prima di collegare, nell'app <span className="text-chalk">Google Health</span> del telefono
            tocca “Accedi con Google” e scegli questo account (oppure migra il tuo account Fitbit): senza quel profilo Google non ha dati da dare.
          </p>
          <GoogleHealthDisclosure />
          {!consent.valid && <ConsentCheckbox checked={checked} onChange={setChecked} label="Ho letto e acconsento al trattamento dei miei dati sulla salute come descritto nell'" />}
          <Button variant="primary" disabled={health.busy || !canConnect} onClick={connect}>{health.busy ? 'Collego…' : 'Collega Google Health'}</Button>
        </div>
      )}
      {health.source === 'healthconnect' && !health.connected && (
        <div className="space-y-3 text-sm text-muted">
          <HealthConnectDisclosure />
          {!consent.valid && <ConsentCheckbox checked={checked} onChange={setChecked} label="Ho letto e acconsento al trattamento dei miei dati sulla salute come descritto nell'" />}
          <Button variant="primary" disabled={health.busy || !canConnect} onClick={connect}>Collega Health Connect</Button>
        </div>
      )}

      {health.source !== 'none' && health.connected && (
        <div className="space-y-3">
          {health.needsAuth && (
            <div role="status" className="space-y-2 rounded-xl border border-plate/50 bg-plate/10 p-3 text-sm">
              <p>Il permesso di Google è scaduto (dura circa un'ora): alcuni dati aspettano di essere inviati.</p>
              <Button size="sm" variant="primary" icon={<RefreshCw className="h-4 w-4" />} disabled={health.busy} onClick={() => void consent.ensure().then((ok) => { if (ok) void health.connect(); })}>Ricollega Google Health</Button>
            </div>
          )}
          <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoLog} onChange={(e) => health.setAutoLog(e.target.checked)} />
            <span>
              <span className="block font-semibold">{health.source === 'googlehealth' ? 'Registra gli allenamenti su Google Health' : 'Salva gli allenamenti in Health Connect'}</span>
              <span className="block text-sm text-muted">
                {health.source === 'googlehealth'
                  ? 'Compaiono come “allenamento di forza” con durata e calorie stimate; importo la frequenza se l\'orologio ha già sincronizzato.'
                  : 'Con il loro tipo (forza, corsa, bici, nuoto, pilates…), durata, serie, volume e distanza. Health Connect ti chiede il permesso.'}
              </span>
            </span>
          </label>
          {health.unsent > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{health.unsent} {health.unsent === 1 ? 'allenamento non è stato inviato' : 'allenamenti non sono stati inviati'}.</span>
              <Button size="sm" disabled={health.busy} onClick={() => void health.syncAllSessions()}>{health.busy ? 'Invio…' : 'Invia ora'}</Button>
            </div>
          )}
          {health.source === 'googlehealth' && (
            <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoMeals} onChange={(e) => health.setAutoMeals(e.target.checked)} />
              <span>
                <span className="block font-semibold">Invia i pasti a Google Health</span>
                <span className="block text-sm text-muted">Calorie e macro di ogni pasto che salvi. Serve un permesso in più: dopo averlo attivato tocca «Ricollega Google Health» per accettarlo. Fibre e zuccheri restano solo nell'app.</span>
              </span>
            </label>
          )}
          {health.source === 'googlehealth' && health.autoMeals && <div className="text-muted"><GoogleHealthDisclosure short /></div>}
          {health.source === 'healthconnect' && (
            <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoMeals} onChange={(e) => health.setAutoMeals(e.target.checked)} />
              <span>
                <span className="block font-semibold">Invia pasti e acqua a Health Connect</span>
                <span className="block text-sm text-muted">Le calorie di ogni pasto e l'acqua che segni. Health Connect ti chiede i nuovi permessi. Le modifiche e le cancellazioni fatte dopo l'invio restano solo in Ferro; macro, fibre e zuccheri restano solo nell'app.</span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon={<Scale className="h-4 w-4" />} disabled={health.busy} onClick={() => void importBody()}>{health.busy ? 'Importo…' : 'Importa pesate (30 giorni)'}</Button>
            {health.source === 'healthconnect' && <Button disabled={health.busy} onClick={() => void consent.ensure().then((ok) => { if (ok) void health.importWatch(); })}>Importa dall'orologio (14 giorni)</Button>}
            {health.source === 'healthconnect' && <Button icon={<ExternalLink className="h-4 w-4" />} onClick={() => void openHealthConnectSettings()}>Permessi</Button>}
            <Button variant="ghost" onClick={health.disconnect}>Scollega {name}</Button>
          </div>
          <button type="button" className="text-sm text-plate underline" aria-expanded={showInfo} onClick={() => setShowInfo((v) => !v)}>Cosa fa Ferro con {name}</button>
          {showInfo && <div className="text-muted">{health.source === 'googlehealth' ? <GoogleHealthDisclosure /> : <HealthConnectDisclosure />}</div>}
        </div>
      )}
    </section>
  );
}
