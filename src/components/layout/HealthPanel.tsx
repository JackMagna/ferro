import { useState } from 'react';
import { ExternalLink, RefreshCw, Scale } from '../ui/icons';
import { ConsentCheckbox, useHealthConsent } from '../privacy/HealthConsent';
import { GOOGLE_USER_DATA_POLICY } from '../../lib/links';
import type { HealthApi } from '../../hooks/useHealthSync';
import { isAndroidApp, openHealthConnectSettings } from '../../services/healthConnect';
import type { HealthSource } from '../../services/health';
import { Button } from '../ui/Button';
import { t } from '../../lib/i18n';

/** Testo tradotto con le parti tra ** in grassetto. */
const bold = (s: string) => s.split('**').map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));

/**
 * Disclosure richiesta da Google per gli ambiti «restricted» della Google Health API:
 * deve dire esattamente cosa fa il codice (letture: fetchBody, fetchHeartRate; scritture: writeBody, logWorkout, writeMeal).
 */
function GoogleHealthDisclosure({ short = false }: { short?: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-ink p-3 text-sm">
      <p className="font-semibold text-chalk">{t('Cosa fa Ferro con Google Health')}</p>
      {!short && <p>{t('Quando colleghi Google Health, Ferro:')}</p>}
      <ul className="space-y-1 pl-5 [list-style:disc]">
        {!short && <li>{bold(t('**legge** il tuo peso, la massa grassa e la frequenza cardiaca (negli ultimi 30 giorni, quando importi);'))}</li>}
        <li>{bold(short ? t('**scrive** le calorie e i macronutrienti di ogni pasto che salvi, solo se attivi questa opzione.') : t('**scrive** le tue pesate, i tuoi allenamenti e, solo se lo attivi, i pasti (calorie e macronutrienti).'))}</li>
      </ul>
      <p>{bold(t("**Come li usa.** Solo per mostrarti i tuoi progressi nell'app e tenere i dati allineati. Non li usa per pubblicità, non li vende e non li condivide con altri. I dati letti restano nel tuo spazio privato di Ferro e sul tuo dispositivo."))}</p>
      {!short && (
        <>
          <p>{t("L'uso e il trasferimento delle informazioni ricevute dalle API di Google rispettano la")} <a href={GOOGLE_USER_DATA_POLICY} target="_blank" rel="noopener" className="text-plate underline">Google API Services User Data Policy</a>{t(', compresi i requisiti di uso limitato.')}</p>
          <p>{t('Puoi scollegare Google Health quando vuoi da qui, e revocare i permessi dal tuo account Google.')}</p>
        </>
      )}
    </div>
  );
}

function HealthConnectDisclosure() {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-ink p-3 text-sm">
      <p className="font-semibold text-chalk">{t('Cosa fa Ferro con Health Connect')}</p>
      <ul className="space-y-1 pl-5 [list-style:disc]">
        <li>{bold(t("**legge** peso, massa grassa, frequenza cardiaca e calorie bruciate con l'attività; solo quando tocchi «Importa dall'orologio», gli allenamenti delle ultime 2 settimane registrati da altre app, con la distanza;"))}</li>
        <li>{bold(t("**scrive** peso e massa grassa che inserisci in Ferro, gli allenamenti (tipo, durata, serie, volume e distanza) e, solo se lo attivi, le calorie dei pasti e l'acqua bevuta."))}</li>
      </ul>
      <p>{t('Solo per mostrarti i tuoi progressi. Niente pubblicità, niente cessione a terzi. I permessi si gestiscono da Health Connect.')}</p>
    </div>
  );
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Cosa Ferro può fare davvero in Health Connect, e l'ultimo errore: per capire subito se qualcosa si blocca. */
function HealthConnectStatusBox({ health }: { health: HealthApi }) {
  const s = health.hcStatus;
  const items: [string, boolean | undefined][] = s
    ? [
        [t('Allenamenti'), s.workouts],
        [t('Peso'), s.write.includes('weight')],
        [t('Frequenza cardiaca'), s.read.includes('heartRate')]
      ]
    : [];
  return (
    <div className="space-y-2 rounded-xl border border-line p-3 text-sm" role="status">
      <p className="font-semibold">{t('Permessi concessi a Ferro')}</p>
      {s ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {items.map(([label, ok]) => (
            <li key={label} className={ok === false ? 'text-stop' : 'text-muted'}>
              {ok === undefined ? '?' : ok ? '✓' : '✗'} {label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{t('Health Connect non risponde: controlla che sia installato e aggiornato.')}</p>
      )}
      {s?.workouts === false && (
        <div className="space-y-2">
          <p>{t('Manca il permesso per gli allenamenti: Ferro non può salvarli in Health Connect.')}</p>
          <Button size="sm" variant="primary" disabled={health.busy} onClick={() => void health.connect()}>{t('Concedi i permessi')}</Button>
        </div>
      )}
      <p className="text-muted">
        {health.lastSentAt ? t('Ultimo invio riuscito: {quando}', { quando: when(health.lastSentAt) }) : t('Nessun invio riuscito finora.')}
      </p>
      {health.lastError && (
        <p className="text-stop">
          {t('Ultimo errore: {err}', { err: health.lastError })}
          {health.lastErrorAt ? ` (${when(health.lastErrorAt)})` : ''}
        </p>
      )}
    </div>
  );
}

const OPTIONS: { id: HealthSource; label: string; hint: string }[] = [
  { id: 'none', label: t('Nessuna'), hint: t('Non collegare niente') },
  { id: 'googlehealth', label: 'Google Health', hint: t('Anche dal sito. Consigliata') },
  { id: 'healthconnect', label: 'Health Connect', hint: t("Solo nell'app Android") }
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
      <h3 className="font-display text-lg font-semibold">{t('Dati salute')}</h3>
      <p className="text-sm text-muted">{t("Scegli da dove importare peso, massa grassa e frequenza cardiaca. Le pesate che inserisci nell'app vengono inviate alla stessa fonte.")}</p>

      <div role="radiogroup" aria-label={t('Fonte dati salute')} className="grid gap-2">
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
              <span className="text-sm text-muted">{o.id === 'googlehealth' && android ? t('Solo dal sito') : disabled ? t("Serve l'app Android") : o.hint}</span>
            </button>
          );
        })}
      </div>

      {health.source === 'googlehealth' && android && !health.connected && (
        <div role="status" className="space-y-2 rounded-xl border border-plate/50 bg-plate/10 p-3 text-sm">
          <p>
            {bold(t("Dall'app Android Google Health rifiuta il collegamento. Qui usa **Health Connect**: l'app Google Health (o Fitbit) del telefono legge da Health Connect, se nelle sue impostazioni è attiva la sincronizzazione. Dal sito Google Health funziona."))}
          </p>
          <Button size="sm" variant="primary" onClick={() => health.setSource('healthconnect')}>{t('Passa a Health Connect')}</Button>
        </div>
      )}
      {health.source === 'googlehealth' && !android && !health.connected && (
        <div className="space-y-3 text-sm text-muted">
          <p>
            {t("Usa lo stesso account Google con cui accedi. Prima di collegare, nell'app Google Health del telefono tocca “Accedi con Google” e scegli questo account (oppure migra il tuo account Fitbit): senza quel profilo Google non ha dati da dare.")}
          </p>
          <GoogleHealthDisclosure />
          {!consent.valid && <ConsentCheckbox checked={checked} onChange={setChecked} label={t("Ho letto e acconsento al trattamento dei miei dati sulla salute come descritto nell'")} />}
          <Button variant="primary" disabled={health.busy || !canConnect} onClick={connect}>{health.busy ? t('Collego…') : t('Collega Google Health')}</Button>
        </div>
      )}
      {health.source === 'healthconnect' && !health.connected && (
        <div className="space-y-3 text-sm text-muted">
          <HealthConnectDisclosure />
          {!consent.valid && <ConsentCheckbox checked={checked} onChange={setChecked} label={t("Ho letto e acconsento al trattamento dei miei dati sulla salute come descritto nell'")} />}
          <Button variant="primary" disabled={health.busy || !canConnect} onClick={connect}>{t('Collega Health Connect')}</Button>
        </div>
      )}

      {health.source !== 'none' && health.connected && (
        <div className="space-y-3">
          {health.needsAuth && (
            <div role="status" className="space-y-2 rounded-xl border border-plate/50 bg-plate/10 p-3 text-sm">
              <p>{t("Il permesso di Google è scaduto (dura circa un'ora): alcuni dati aspettano di essere inviati.")}</p>
              <Button size="sm" variant="primary" icon={<RefreshCw className="h-4 w-4" />} disabled={health.busy} onClick={() => void consent.ensure().then((ok) => { if (ok) void health.connect(); })}>{t('Ricollega Google Health')}</Button>
            </div>
          )}
          <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoLog} onChange={(e) => health.setAutoLog(e.target.checked)} />
            <span>
              <span className="block font-semibold">{health.source === 'googlehealth' ? t('Registra gli allenamenti su Google Health') : t('Salva gli allenamenti in Health Connect')}</span>
              <span className="block text-sm text-muted">
                {health.source === 'googlehealth'
                  ? t("Compaiono come “allenamento di forza” con durata e calorie stimate; importo la frequenza se l'orologio ha già sincronizzato.")
                  : t('Con il loro tipo (forza, corsa, bici, nuoto, pilates…), durata, serie, volume e distanza. Health Connect ti chiede il permesso.')}
              </span>
            </span>
          </label>
          {health.source === 'healthconnect' && <HealthConnectStatusBox health={health} />}
          {health.unsent > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{health.unsent === 1 ? t('1 allenamento non è stato inviato.') : t('{n} allenamenti non sono stati inviati.', { n: health.unsent })}</span>
              <Button size="sm" disabled={health.busy} onClick={() => void health.syncAllSessions()}>{health.busy ? t('Invio…') : t('Invia ora')}</Button>
            </div>
          )}
          {health.source === 'googlehealth' && (
            <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoMeals} onChange={(e) => health.setAutoMeals(e.target.checked)} />
              <span>
                <span className="block font-semibold">{t('Invia i pasti a Google Health')}</span>
                <span className="block text-sm text-muted">{t("Calorie e macro di ogni pasto che salvi. Serve un permesso in più: dopo averlo attivato tocca «Ricollega Google Health» per accettarlo. Fibre e zuccheri restano solo nell'app.")}</span>
              </span>
            </label>
          )}
          {health.source === 'googlehealth' && health.autoMeals && <div className="text-muted"><GoogleHealthDisclosure short /></div>}
          {health.source === 'healthconnect' && (
            <label className="flex items-start gap-3 rounded-xl bg-ink p-3">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-plate" checked={health.autoMeals} onChange={(e) => health.setAutoMeals(e.target.checked)} />
              <span>
                <span className="block font-semibold">{t('Invia pasti e acqua a Health Connect')}</span>
                <span className="block text-sm text-muted">{t("Le calorie di ogni pasto e l'acqua che segni. Health Connect ti chiede i nuovi permessi. Le modifiche e le cancellazioni fatte dopo l'invio restano solo in Ferro; macro, fibre e zuccheri restano solo nell'app.")}</span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon={<Scale className="h-4 w-4" />} disabled={health.busy} onClick={() => void importBody()}>{health.busy ? t('Importo…') : t('Importa pesate (30 giorni)')}</Button>
            {health.source === 'healthconnect' && <Button disabled={health.busy} onClick={() => void consent.ensure().then((ok) => { if (ok) void health.importWatch(); })}>{t("Importa dall'orologio (14 giorni)")}</Button>}
            {health.source === 'healthconnect' && <Button icon={<ExternalLink className="h-4 w-4" />} onClick={() => void openHealthConnectSettings()}>{t('Permessi')}</Button>}
            <Button variant="ghost" onClick={health.disconnect}>{t('Scollega {app}', { app: name })}</Button>
          </div>
          <button type="button" className="text-sm text-plate underline" aria-expanded={showInfo} onClick={() => setShowInfo((v) => !v)}>{t('Cosa fa Ferro con {app}', { app: name })}</button>
          {showInfo && <div className="text-muted">{health.source === 'googlehealth' ? <GoogleHealthDisclosure /> : <HealthConnectDisclosure />}</div>}
        </div>
      )}
    </section>
  );
}
