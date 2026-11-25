import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FoodEntry, Measurement, WorkoutSession } from '../types';
import type { AppDataActions } from './useAppData';
import type { BodyEntry } from '../lib/healthMath';
import { newId } from '../lib/ids';
import { watchSessions } from '../lib/watchImport';
import { t } from '../lib/i18n';
import {
  getHealthPrefs, getHealthSource, isGoogleHealthConnected, SOURCE_LABEL, setGoogleHealthConnected, setHealthPrefs, setHealthSource,
  subscribeHealth
} from '../services/health';
import * as gh from '../services/googleHealth';
import * as hc from '../services/healthConnect';
import { authErrorMessage, clearGoogleToken, ensureGoogleToken, getValidGoogleToken, withGoogleToken } from '../services/firebase';

interface Args {
  sessions: WorkoutSession[];
  measurements: Measurement[];
  meals: FoodEntry[];
  actions: AppDataActions;
  hasSheet: boolean;
  /** senza consenso ai dati sanitari non si invia niente a Google Health / Health Connect */
  consented: boolean;
  notify: (message: string, kind?: 'success' | 'error') => void;
}

type HR = { avg: number; max: number } | null;
/** `undefined` = serve ricollegare Google (il permesso dura circa un'ora); non è un errore. */
interface Ops {
  heartRate(s: WorkoutSession, interactive: boolean): Promise<HR | undefined>;
  readBody(interactive: boolean): Promise<BodyEntry[] | undefined>;
  writeBody(e: BodyEntry, interactive: boolean): Promise<true | undefined>;
}

const GOOGLE: Ops = {
  heartRate: (s, i) => withGoogleToken((tk) => gh.fetchHeartRate(tk, s), i, 'health'),
  readBody: (i) => withGoogleToken((tk) => gh.fetchBody(tk, 30), i, 'health'),
  writeBody: (e, i) => withGoogleToken(async (tk) => { await gh.writeBody(tk, e); return true as const; }, i, 'health')
};
const CONNECT: Ops = {
  heartRate: (s) => hc.readHeartRate(s),
  readBody: () => hc.readBody(30),
  writeBody: async (e) => { await hc.writeBody(e); return true as const; }
};

/**
 * Peso, massa grassa e frequenza cardiaca da Google Health oppure da Health Connect (una fonte per volta).
 * Entrambe registrano anche l'allenamento (Health Connect tramite il plugin nativo di Ferro).
 */
export function useHealthSync(args: Args) {
  const source = useSyncExternalStore(subscribeHealth, getHealthSource);
  const ghConnected = useSyncExternalStore(subscribeHealth, isGoogleHealthConnected);
  const hcConnected = useSyncExternalStore(subscribeHealth, hc.isHealthConnectConnected);
  const autoLog = useSyncExternalStore(subscribeHealth, () => getHealthPrefs().autoLog);
  const autoMeals = useSyncExternalStore(subscribeHealth, () => getHealthPrefs().autoMeals);
  const connected = source === 'googlehealth' ? ghConnected : source === 'healthconnect' ? hcConnected : false;

  const latest = useRef(args);
  latest.current = args;
  const inFlight = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [tick, setTick] = useState(0); // dopo un nuovo collegamento si riprovano gli invii in attesa
  const ops = source === 'googlehealth' ? GOOGLE : source === 'healthconnect' ? CONNECT : null;
  const fail = (err: unknown) => latest.current.notify(err instanceof Error ? err.message : t('La fonte dati non risponde'), 'error');
  const lastWeight = () => [...latest.current.measurements].filter((m) => m.weightKg !== undefined).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg;

  /* ---- allenamento su Google Health o Health Connect ---- */
  const syncSession = useCallback(async (s: WorkoutSession, interactive: boolean, quiet = false): Promise<boolean> => {
    if (inFlight.current.has(s.id)) return false;
    if (getHealthSource() === 'healthconnect') {
      inFlight.current.add(s.id);
      try {
        await hc.writeWorkout(s);
        latest.current.actions.updateSession(s.id, { healthSynced: true, healthLogId: 'hc' });
        if (interactive && !quiet) latest.current.notify(t('Allenamento salvato in Health Connect'));
        return true;
      } catch (err) {
        failed.current.add(s.id);
        fail(err);
        return false;
      } finally {
        inFlight.current.delete(s.id);
      }
    }
    if (!interactive && !getValidGoogleToken('health')) { setNeedsAuth(true); return false; }
    inFlight.current.add(s.id);
    try {
      const patch: Partial<WorkoutSession> = {};
      let current = s;
      if (!s.avgBpm) {
        const hr = await GOOGLE.heartRate(s, interactive).catch(() => null); // la frequenza è un di più
        if (hr) { patch.avgBpm = hr.avg; patch.maxBpm = hr.max; current = { ...s, ...patch }; }
      }
      const id = await withGoogleToken((tk) => gh.logWorkout(tk, current, lastWeight()), interactive, 'health');
      if (id === undefined) { setNeedsAuth(true); return false; }
      patch.healthLogId = id || undefined;
      patch.healthSynced = true;
      latest.current.actions.updateSession(s.id, patch);
      setNeedsAuth(false);
      if (interactive && !quiet) latest.current.notify(t('Allenamento registrato su Google Health'));
      return true;
    } catch (err) {
      failed.current.add(s.id);
      fail(err);
      return false;
    } finally {
      inFlight.current.delete(s.id);
    }
  }, []);

  useEffect(() => {
    if (!connected || !autoLog || !args.consented) return;
    args.sessions.filter((s) => s.healthSynced === false && !failed.current.has(s.id)).forEach((s) => void syncSession(s, false));
  }, [args.sessions, source, connected, autoLog, syncSession, tick, args.consented]);

  /** Allenamenti non ancora inviati alla fonte collegata (anche quelli salvati prima di collegarla). */
  const unsent = connected ? args.sessions.filter((s) => s.healthSynced !== true) : [];
  /** Reinvia tutti gli allenamenti non inviati, uno alla volta (dopo un tocco: può chiedere il permesso Google). */
  const syncAllSessions = useCallback(async () => {
    const list = latest.current.sessions.filter((s) => s.healthSynced !== true);
    if (!list.length) return;
    setBusy(true);
    failed.current.clear();
    let sent = 0;
    try {
      for (const s of list) if (await syncSession(s, true, true)) sent++;
    } finally {
      setBusy(false);
    }
    const where = SOURCE_LABEL[getHealthSource()];
    latest.current.notify(sent === list.length ? t('Inviati {n} allenamenti a {app}', { n: sent, app: where }) : t('Inviati {n} allenamenti su {tot} a {app}', { n: sent, tot: list.length, app: where }), sent === list.length ? 'success' : 'error');
  }, [syncSession]);

  /* ---- pasti su Google Health (modificare un pasto già inviato = eliminare e ricreare) ---- */
  const syncMeal = useCallback(async (m: FoodEntry) => {
    if (inFlight.current.has(m.id)) return;
    if (!getValidGoogleToken('health')) { setNeedsAuth(true); return; }
    inFlight.current.add(m.id);
    try {
      const id = await withGoogleToken(async (tk) => {
        if (m.healthLogId) await gh.deleteMeals(tk, [m.healthLogId]);
        return gh.writeMeal(tk, m);
      }, false, 'health');
      if (id === undefined) { setNeedsAuth(true); return; }
      latest.current.actions.updateMeal(m.id, { healthSynced: true, healthLogId: id || undefined });
      setNeedsAuth(false);
    } catch (err) {
      failed.current.add(m.id);
      fail(err);
    } finally {
      inFlight.current.delete(m.id);
    }
  }, []);

  useEffect(() => {
    if (source !== 'googlehealth' || !ghConnected || !autoMeals || !args.consented) return;
    args.meals.filter((m) => m.healthSynced === false && !failed.current.has(m.id)).forEach((m) => void syncMeal(m));
  }, [args.meals, source, ghConnected, autoMeals, syncMeal, tick, args.consented]);

  /* ---- pasti su Health Connect: solo le calorie, una volta (da qui non si possono modificare né cancellare) ---- */
  useEffect(() => {
    if (source !== 'healthconnect' || !hcConnected || !autoMeals || !args.consented) return;
    args.meals
      .filter((m) => m.healthSynced === false && !inFlight.current.has(m.id) && !failed.current.has(m.id))
      .forEach(async (m) => {
        inFlight.current.add(m.id);
        try {
          if (m.healthLogId !== 'hc') await hc.writeMeal(m);
          latest.current.actions.updateMeal(m.id, { healthSynced: true, healthLogId: 'hc' });
        } catch (err) {
          failed.current.add(m.id);
          fail(err);
        } finally {
          inFlight.current.delete(m.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.meals, source, hcConnected, autoMeals, tick, args.consented]);

  /** Acqua aggiunta nell'app: va in Health Connect se è collegato e l'invio dei pasti è attivo. */
  const logWater = useCallback(async (ml: number, at?: number) => {
    if (source !== 'healthconnect' || !hcConnected || !autoMeals || !latest.current.consented || ml <= 0) return;
    try {
      await hc.writeWater(ml, at);
    } catch (err) {
      fail(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, hcConnected, autoMeals]);

  /** Calorie bruciate con l'attività nel giorno, da Health Connect. Null se non disponibili. */
  const readActiveCalories = useCallback(async (date: string): Promise<number | null> => {
    if (source !== 'healthconnect' || !hcConnected || !latest.current.consented) return null;
    return hc.readActiveCalories(date).catch(() => null);
  }, [source, hcConnected]);

  /** Elimina da Google Health il pasto che l'utente cancella nell'app (se era stato inviato). */
  const removeMeal = useCallback(async (m: FoodEntry) => {
    if (!m.healthLogId || source !== 'googlehealth' || !ghConnected) return;
    try {
      const ok = await withGoogleToken(async (tk) => { await gh.deleteMeals(tk, [m.healthLogId!]); return true as const; }, false, 'health');
      if (ok === undefined) latest.current.notify(t('Il pasto è stato eliminato qui ma resta su Google Health: ricollega Google Health per cancellarlo anche lì.'), 'error');
    } catch (err) {
      fail(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, ghConnected]);

  /* ---- misure dell'app verso la fonte dati ---- */
  useEffect(() => {
    if (!ops || !connected || !args.consented) return;
    args.measurements
      .filter((m) => m.healthSynced === false && !inFlight.current.has(m.id) && !failed.current.has(m.id))
      .forEach(async (m) => {
        inFlight.current.add(m.id);
        try {
          if (m.weightKg !== undefined || m.bodyFat !== undefined) {
            const ok = await ops.writeBody({ date: m.date, weightKg: m.weightKg, bodyFat: m.bodyFat }, false);
            if (ok === undefined) { setNeedsAuth(true); return; }
          }
          latest.current.actions.updateMeasurement(m.id, { healthSynced: true });
        } catch (err) {
          failed.current.add(m.id);
          fail(err);
        } finally {
          inFlight.current.delete(m.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.measurements, source, connected, tick, args.consented]);

  const importHeartRate = useCallback(async (s: WorkoutSession) => {
    if (!ops) return;
    setBusy(true);
    try {
      const hr = await ops.heartRate(s, true);
      if (!hr) {
        latest.current.notify(t("Non ci sono ancora dati di frequenza per questo allenamento. Sincronizza l'orologio nell'app Google Health e riprova tra qualche minuto."), 'error');
        return;
      }
      latest.current.actions.updateSession(s.id, { avgBpm: hr.avg, maxBpm: hr.max });
      latest.current.notify(t('Frequenza importata: {avg} bpm medi, {max} massimi', { avg: hr.avg, max: hr.max }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const importBody = useCallback(async () => {
    if (!ops || source === 'none') return;
    setBusy(true);
    try {
      const entries = await ops.readBody(true);
      if (!entries) return;
      const known = latest.current.measurements;
      const fresh = entries.filter((e) => !known.some((m) => m.date === e.date && (e.weightKg === undefined || m.weightKg === undefined || Math.abs(m.weightKg - e.weightKg) < 0.1)));
      fresh.forEach((e) =>
        latest.current.actions.addMeasurement({
          id: newId('m'), date: e.date, weightKg: e.weightKg, bodyFat: e.bodyFat, source: SOURCE_LABEL[source],
          healthSynced: true, sheetsSynced: latest.current.hasSheet ? false : undefined
        })
      );
      latest.current.notify(fresh.length ? t('Importate {n} pesate da {app}', { n: fresh.length, app: SOURCE_LABEL[source] }) : entries.length ? t('Nessuna pesata nuova: hai già tutto.') : t('{app} non ha pesate negli ultimi 30 giorni.', { app: SOURCE_LABEL[source] }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  /** Attività registrate dall'orologio negli ultimi 14 giorni (Health Connect), con la frequenza se c'è. */
  const importWatch = useCallback(async () => {
    if (source !== 'healthconnect' || !hcConnected) return;
    if (!latest.current.consented) { latest.current.notify(t('Prima serve il consenso ai dati sulla salute.'), 'error'); return; }
    setBusy(true);
    try {
      const found = watchSessions(await hc.readWatchWorkouts(14), latest.current.sessions);
      for (const s of found) {
        const hr = await hc.readHeartRate(s).catch(() => null);
        latest.current.actions.addSession(hr ? { ...s, avgBpm: hr.avg, maxBpm: hr.max } : s);
      }
      latest.current.notify(found.length === 1 ? t("Importata 1 attività dall'orologio") : found.length ? t("Importate {n} attività dall'orologio", { n: found.length }) : t('Nessuna attività nuova negli ultimi 14 giorni.'));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, hcConnected]);

  /** Collega la fonte scelta. Con Google apre il popup dei permessi e verifica il profilo Google Health. */
  const connect = useCallback(async () => {
    setBusy(true);
    try {
      if (source === 'googlehealth') {
        const token = await ensureGoogleToken('health');
        await gh.checkLinked(token);
        setGoogleHealthConnected(true);
        latest.current.notify(t('Google Health collegato'));
      } else if (source === 'healthconnect') {
        await hc.connectHealthConnect();
        // gli allenamenti hanno un permesso a parte, chiesto dal plugin di Ferro
        const workouts = getHealthPrefs().autoLog ? await hc.requestWorkoutPermission().catch(() => false) : true;
        latest.current.notify(workouts ? t('Health Connect collegato') : t('Health Connect collegato, ma senza il permesso per gli allenamenti: non verranno salvati lì.'), workouts ? 'success' : 'error');
      }
      failed.current.clear();
      setNeedsAuth(false);
      setTick((n) => n + 1);
    } catch (err) {
      const message = err instanceof gh.HealthNotLinkedError || source === 'healthconnect' ? err instanceof Error ? err.message : '' : authErrorMessage(err);
      if (message && message !== t('Accesso annullato.')) latest.current.notify(message, 'error');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const disconnect = () => {
    if (source === 'googlehealth') { setGoogleHealthConnected(false); clearGoogleToken('health'); setNeedsAuth(false); }
    else hc.disconnectHealthConnect();
  };

  return {
    source,
    setSource: setHealthSource,
    connected,
    autoLog,
    autoMeals,
    busy,
    needsAuth,
    connect,
    disconnect,
    setAutoLog: (v: boolean) => {
      failed.current.clear();
      setHealthPrefs({ autoLog: v });
      if (v && source === 'healthconnect') void hc.requestWorkoutPermission().catch(fail);
    },
    setAutoMeals: (v: boolean) => {
      failed.current.clear();
      setHealthPrefs({ autoMeals: v });
      // Health Connect: chi l'aveva già collegato deve concedere i nuovi permessi (calorie dei pasti e acqua)
      if (v && source === 'healthconnect') void connect();
    },
    removeMeal,
    logWater,
    readActiveCalories,
    syncSession: (s: WorkoutSession) => { failed.current.delete(s.id); return syncSession(s, true); },
    unsent: unsent.length,
    syncAllSessions,
    importHeartRate,
    importBody,
    importWatch
  };
}

export type HealthApi = ReturnType<typeof useHealthSync>;
