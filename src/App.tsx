import { useEffect, useRef, useState } from 'react';
import { t } from './lib/i18n';
import type { User } from 'firebase/auth';
import { authErrorMessage, deleteAccount, logout, signInWithGoogle, watchAuth } from './services/firebase';
import { useAppData } from './hooks/useAppData';
import { useSheetsSync } from './hooks/useSheetsSync';
import { useHealthSync } from './hooks/useHealthSync';
import { useCoachSheetWatch } from './hooks/useCoachSheetWatch';
import { useWidgetSync } from './hooks/useWidgetSync';
import { useCommunityLinks } from './hooks/useCommunityLinks';
import { linkByName } from './lib/exerciseLinks';
import { shareLink } from './services/exerciseLinks';
import { CoachUpdateBanner } from './components/program/CoachUpdate';
import { getHealthPrefs, getHealthSource } from './services/health';
import { readJSON, removeKey, writeJSON } from './lib/storage';
import { AppShell, type Tab } from './components/layout/AppShell';
import { AccountSheet } from './components/layout/AccountSheet';
import { UpdateBanner } from './components/layout/UpdateBanner';
import { Welcome } from './components/onboarding/Welcome';
import { WorkoutScreen } from './components/workout/WorkoutScreen';
import { ProgramScreen } from './components/program/ProgramScreen';
import { TodayLessons } from './components/lessons/TodayLessons';
import { LibraryScreen } from './components/exercise/LibraryScreen';
import { NutritionScreen } from './components/nutrition/NutritionScreen';
import { ProgressScreen } from './components/progress/ProgressScreen';
import { useToast } from './components/ui/Toast';
import { Logo } from './components/layout/Logo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseAppleImport } from './lib/appleHealthBridge';
import { newId, todayISO } from './lib/ids';
import type { FoodEntry } from './types';
import { hasValidConsent } from './lib/consent';
import { recordAuthResult, storedUserCheck } from './lib/authProbe';
import { HealthConsentContext, useHealthConsentGate } from './components/privacy/HealthConsent';

const GUEST_KEY = 'irontrack:guest';

export default function App() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guest, setGuest] = useState(() => readJSON<boolean>(GUEST_KEY, false) || readJSON<unknown>('irontrack_initialized', null) === true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>('workout');
  const [accountOpen, setAccountOpen] = useState(false);
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const [editProgram, setEditProgram] = useState(false);
  const [data, actions] = useAppData(user, (msg) => toast(msg, 'error'));

  // Attenzione: in Chrome recenti scrollTo restituisce una Promise. Se l'effetto la restituisce,
  // React la tratta come funzione di pulizia e va in crash al cambio di sezione. Serve il blocco { }.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const notify = (message: string, kind: 'success' | 'error' = 'success') => toast(message, kind);
  const consented = hasValidConsent(data.consent);
  const sync = useSheetsSync({ user, spreadsheetId: data.spreadsheetId, program: data.program, sessions: data.sessions, measurements: data.measurements, actions, notify, healthConsent: consented });
  const coachWatch = useCoachSheetWatch({ user, spreadsheetId: data.spreadsheetId, program: data.program, onSaveProgram: actions.saveProgram });
  const health = useHealthSync({ sessions: data.sessions, measurements: data.measurements, meals: data.meals, actions, hasSheet: !!data.spreadsheetId, notify, consented });
  useWidgetSync({ ready: data.ready, program: data.program, sessions: data.sessions, meals: data.meals, dietPlan: data.dietPlan, consented, onLaunchTab: setTab });
  useCommunityLinks({ user, ready: data.ready, program: data.program, onSaveProgram: actions.saveProgram, notify: (m) => toast(m) });

  /** Foto corretta durante l'allenamento: vale per tutti gli esercizi con quel nome e diventa un voto per gli altri. */
  const linkExercise = (name: string, libraryId: string | undefined, previous: string | undefined) => {
    actions.saveProgram(linkByName(data.program, name, libraryId));
    void shareLink(name, libraryId, previous);
    toast(libraryId ? t('Foto aggiornata') : t('Foto tolta'));
  };

  /** Elimina misure, pasti e dieta (dopo conferma). I dati già inviati a Google Health, Health Connect o al foglio restano lì. */
  const deleteHealthData = (confirmed = false) => {
    if (!confirmed && !window.confirm(t('Eliminare misure, pasti, acqua e dieta salvati in Ferro? Non si può annullare. I dati già inviati a Google Health, Health Connect, Apple Salute o al foglio del coach restano lì.'))) return;
    data.measurements.forEach((m) => actions.deleteMeasurement(m.id));
    data.meals.forEach((m) => actions.deleteMeal(m.id));
    if (data.dietPlan) actions.saveDietPlan(null);
    if (data.savedMeals.length) actions.saveSavedMeals([]);
    Object.keys(data.water).forEach((date) => actions.setWater(date, 0));
    toast(t('Dati sanitari eliminati'));
  };
  /** Pasto da inviare alla fonte dati salute, se è collegata e l'invio dei pasti è attivo. */
  const toHealth = (m: FoodEntry): FoodEntry => (health.source !== 'none' && health.connected && health.autoMeals ? { ...m, healthSynced: false } : m);
  const consentGate = useHealthConsentGate({ consent: data.consent, onSave: actions.saveHealthConsent, onDeclined: (m) => toast(m, 'error'), onDeleteHealthData: () => deleteHealthData() });
  const ensureConsent = consentGate.api.ensure;

  // Chi ha già dati sanitari salvati senza consenso lo vede una volta, aprendo Pasti o Progressi.
  useEffect(() => {
    if ((tab === 'nutrition' || tab === 'progress') && data.ready && !consented && (data.measurements.length || data.meals.length || data.dietPlan)) {
      consentGate.api.askExistingOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data.ready, consented]);


  useEffect(() => {
    const unsubscribe = watchAuth((u) => { recordAuthResult(!!u); setUser(u); setAuthReady(true); });
    return unsubscribe;
  }, []);

  // Se Google o Firestore sono lenti o bloccati dalla rete, l'app parte comunque dopo qualche secondo.
  // Con un accesso salvato sul dispositivo si aspetta Firebase più a lungo: mostrare «Accedi» farebbe
  // credere di essere stati scollegati (capitava aprendo l'app installata su Android).
  const [storedUser, setStoredUser] = useState<boolean | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    void storedUserCheck.then(setStoredUser);
    const t = setTimeout(() => setWaitedTooLong(true), 5000);
    const t2 = setTimeout(() => setGaveUp(true), 30_000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);
  useEffect(() => {
    if (waitedTooLong && user && !data.ready) toast(t('Connessione lenta: i dati si aggiorneranno appena Firestore risponde.'), 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitedTooLong]);

  const login = async () => {
    setLoggingIn(true);
    try {
      const u = await signInWithGoogle();
      toast(t('Ciao {nome}', { nome: u.displayName?.split(' ')[0] ?? '' }).trim());
      setAccountOpen(false);
    } catch (err) {
      const msg = authErrorMessage(err);
      if (msg !== t('Accesso annullato.')) toast(msg, 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const startGuest = () => {
    writeJSON(GUEST_KEY, true);
    setGuest(true);
  };

  const signOut = async () => {
    await logout();
    removeKey(GUEST_KEY);
    setGuest(false);
    setAccountOpen(false);
    setTab('workout');
  };

  const removeAccount = async () => {
    if (!window.confirm(t("Eliminare l'account e tutti i dati?") + '\n\n' + t('Scheda, allenamenti, misure, pasti e dieta vengono cancellati per sempre, dal cloud e da questo dispositivo. Non si può annullare.'))) return;
    if (!window.confirm(t('Ultima conferma: eliminare definitivamente il tuo account Ferro?'))) return;
    try {
      await deleteAccount();
      // ricarica per svuotare lo stato in memoria
      window.location.replace(window.location.pathname);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code.includes('popup-closed') || code.includes('cancelled')) return;
      toast(t('Eliminazione non riuscita: {motivo}', { motivo: authErrorMessage(err) }), 'error');
    }
  };

  // Pesate da Apple Salute: il Comando rapido «Salute Ferro» apre l'app con ?salute=…
  const appleImportDone = useRef(false);
  useEffect(() => {
    if (appleImportDone.current || !authReady || (user && !data.ready)) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('salute');
    if (raw === null) return;
    appleImportDone.current = true;
    params.delete('salute');
    window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`);
    const known = data.measurements;
    const fresh = parseAppleImport(raw).filter((e) => !known.some((m) => m.date === e.date && (e.weightKg === undefined || m.weightKg === undefined || Math.abs(m.weightKg - e.weightKg) < 0.1)));
    if (!fresh.length) {
      toast(t('Da Apple Salute non arrivano pesate nuove.'));
      return;
    }
    void (async () => {
      if (!(await ensureConsent())) return;
      if (!window.confirm(fresh.length === 1 ? t('Importare 1 misura da Apple Salute?') : t('Importare {n} misure da Apple Salute?', { n: fresh.length }))) return;
      fresh.forEach((e) => actions.addMeasurement({ id: newId('m'), date: e.date, weightKg: e.weightKg, bodyFat: e.bodyFat, source: 'Apple Salute', sheetsSynced: data.spreadsheetId ? false : undefined }));
      toast(t('Importate {n} misure da Apple Salute', { n: fresh.length }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, data.ready]);

  const importBackup = async (raw: unknown) => {
    const b = raw as { app?: string; program?: unknown } | null;
    if (!b || b.app !== 'irontrack' || !b.program) {
      toast(t('Questo file non è un backup di Ferro.'), 'error');
      return;
    }
    if (!window.confirm(t('Importare il backup? Scheda, allenamenti e misure del file verranno aggiunti o sostituiti.'))) return;
    try {
      await actions.importAll(b as never);
      toast(t('Backup importato'));
      setAccountOpen(false);
    } catch (err) {
      toast(t('Importazione non riuscita: {motivo}', { motivo: err instanceof Error ? err.message : '' }), 'error');
    }
  };

  const authPending = !authReady && (!waitedTooLong || (storedUser !== false && !gaveUp));
  if (authPending || (!waitedTooLong && user && !data.ready)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" aria-busy="true">
        <Logo className="h-12 w-12 animate-pulse" />
        {waitedTooLong ? <p className="text-sm text-muted">{t('Accesso in corso: la connessione è lenta.')}</p> : <span className="sr-only">{t('Caricamento')}</span>}
      </div>
    );
  }

  if (!user && !guest) return <Welcome onLogin={login} onGuest={startGuest} busy={loggingIn} />;

  const accountLabel = user ? (user.displayName?.split(' ')[0] ?? t('Account')) : t('Senza account');

  return (
    <HealthConsentContext.Provider value={consentGate.api}>
    <AppShell tab={tab} onTab={setTab} accountLabel={accountLabel} onAccount={() => setAccountOpen(true)}>
      <UpdateBanner />
      {(tab === 'workout' || tab === 'program') && <CoachUpdateBanner watch={coachWatch} trainer={data.program.trainer} />}
      {/* L'allenamento resta montato: timer e sensore cardio non si interrompono cambiando sezione */}
      <div hidden={tab !== 'workout'}>
        <ErrorBoundary inline resetKey={tab}>
        <div className="mb-4 empty:hidden">
          <TodayLessons
            sessions={data.sessions}
            onLog={(s) => {
              // la lezione fatta è un allenamento: niente foglio del coach, sì Health Connect se è attivo
              actions.addSession({ ...s, healthSynced: health.connected && getHealthPrefs().autoLog ? false : undefined });
              toast(t('Segnata: {titolo}', { titolo: s.dayTitle }));
            }}
          />
        </div>
        <WorkoutScreen
          program={data.program}
          sessions={data.sessions}
          onFinish={(s) => {
            actions.addSession({
              ...s,
              sheetsSynced: data.spreadsheetId ? false : undefined,
              // da inviare se la fonte salute è collegata; gli altri si possono reinviare da Progressi
              healthSynced: health.connected && getHealthPrefs().autoLog ? false : undefined
            });
            toast(t('Allenamento salvato: {n} serie', { n: s.sets.length }));
          }}
          onEditProgram={() => { setEditProgram(true); setTab('program'); }}
          onLinkExercise={linkExercise}
        />
        </ErrorBoundary>
      </div>
      {tab === 'program' && (
        <ErrorBoundary inline resetKey={tab}>
        <ProgramScreen
          user={user}
          program={data.program}
          spreadsheetId={data.spreadsheetId}
          onSaveProgram={actions.saveProgram}
          onSetSpreadsheetId={actions.setSpreadsheetId}
          sync={sync}
          coachWatch={coachWatch}
          onLogin={login}
          startEditing={editProgram}
          onEditingConsumed={() => setEditProgram(false)}
        />
        </ErrorBoundary>
      )}
      {tab === 'nutrition' && (
        <ErrorBoundary inline resetKey={tab}>
          <NutritionScreen
            meals={data.meals}
            plan={data.dietPlan}
            sessions={data.sessions}
            water={data.water}
            savedMeals={data.savedMeals}
            athlete={data.program.athlete}
            onAddMeal={async (m) => { if (!(await ensureConsent())) return; actions.addMeal(toHealth(m)); toast(t('Pasto salvato')); }}
            onAddMeals={async (list) => { if (!(await ensureConsent())) return; list.forEach((m) => actions.addMeal(toHealth(m))); toast(list.length === 1 ? t('Aggiunto 1 cibo') : t('Aggiunti {n} cibi', { n: list.length })); }}
            onUpdateMeal={async (id, patch) => { if (await ensureConsent()) actions.updateMeal(id, patch); }}
            onDeleteMeal={(id) => { const m = data.meals.find((x) => x.id === id); if (m) void health.removeMeal(m); actions.deleteMeal(id); }}
            onSavePlan={async (p) => { if (p && !(await ensureConsent())) return; actions.saveDietPlan(p); toast(p ? t('Dieta salvata') : t('Dieta eliminata')); }}
            onSaveSavedMeals={async (list) => { if (await ensureConsent()) actions.saveSavedMeals(list); }}
            onAddWater={async (date, delta) => {
              if (!(await ensureConsent())) return;
              actions.setWater(date, Math.max(0, (data.water[date] ?? 0) + delta));
              // in Health Connect va solo l'acqua aggiunta: oggi all'ora attuale, gli altri giorni a mezzogiorno
              if (delta > 0) void health.logWater(delta, date === todayISO() ? undefined : new Date(`${date}T12:00:00`).getTime());
            }}
            readActiveCalories={health.source === 'healthconnect' && health.connected ? health.readActiveCalories : undefined}
            notify={notify}
          />
        </ErrorBoundary>
      )}
      {tab === 'library' && <ErrorBoundary inline resetKey={tab}><LibraryScreen /></ErrorBoundary>}
      {tab === 'progress' && (
        <ErrorBoundary inline resetKey={tab}>
        <ProgressScreen
          program={data.program}
          sessions={data.sessions}
          measurements={data.measurements}
          onAddMeasurement={async (m) => {
            if (!(await ensureConsent())) return;
            actions.addMeasurement({ ...m, sheetsSynced: data.spreadsheetId ? false : undefined, healthSynced: getHealthSource() !== 'none' ? false : undefined });
            toast(t('Misura salvata'));
          }}
          onDeleteMeasurement={actions.deleteMeasurement}
          onDeleteSession={actions.deleteSession}
          onStartWorkout={() => setTab('workout')}
          health={health}
          loggedIn={!!user}
          sheetConnected={!!data.spreadsheetId}
          pendingMeasures={data.measurements.filter((m) => m.sheetsSynced === false).length}
          measuresState={sync.measures}
          onSyncMeasures={sync.syncMeasures}
          onResolveMeasure={sync.resolveConflict}
        />
        </ErrorBoundary>
      )}
      <AccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        user={user}
        data={data}
        onLogin={login}
        onLogout={signOut}
        onDeleteAccount={removeAccount}
        onImport={importBackup}
        health={health}
        onDeleteHealthData={deleteHealthData}
      />
    </AppShell>
    {consentGate.sheet}
    </HealthConsentContext.Provider>
  );
}
