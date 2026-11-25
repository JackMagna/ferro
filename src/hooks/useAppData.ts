import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { t } from '../lib/i18n';
import type { DietPlan, FoodEntry, Measurement, SavedMeal, WaterLog, WorkoutProgram, WorkoutSession } from '../types';
import { normalizeDietPlan, normalizeMeal, normalizeMeasurement, normalizeProgram, normalizeSavedMeals, normalizeSession, normalizeWater } from '../services/normalize';
import { clearLocalData, hasLocalActivity, loadLocalData, saveLocalData, type LocalData } from '../services/localStore';
import { clearLocalConsent, normalizeConsent, readLocalConsent, writeLocalConsent, type HealthConsent } from '../lib/consent';

export interface AppData {
  ready: boolean;
  program: WorkoutProgram;
  sessions: WorkoutSession[];
  measurements: Measurement[];
  meals: FoodEntry[];
  dietPlan: DietPlan | null;
  spreadsheetId: string;
  savedMeals: SavedMeal[];
  water: WaterLog;
  /** consenso ai dati sulla salute: non va nel backup e non si importa da file */
  consent: HealthConsent | null;
}

export interface AppDataActions {
  saveProgram(p: WorkoutProgram): void;
  addSession(s: WorkoutSession): void;
  updateSession(id: string, patch: Partial<WorkoutSession>): void;
  deleteSession(id: string): void;
  addMeasurement(m: Measurement): void;
  updateMeasurement(id: string, patch: Partial<Measurement>): void;
  deleteMeasurement(id: string): void;
  addMeal(m: FoodEntry): void;
  updateMeal(id: string, patch: Partial<FoodEntry>): void;
  deleteMeal(id: string): void;
  saveDietPlan(plan: DietPlan | null): void;
  saveSavedMeals(list: SavedMeal[]): void;
  /** millilitri bevuti nel giorno (0 = cancella) */
  setWater(date: string, ml: number): void;
  setSpreadsheetId(id: string): void;
  saveHealthConsent(c: HealthConsent | null): void;
  importAll(data: Omit<AppData, 'ready' | 'consent'>): Promise<void>;
}

const sortSessions = (a: WorkoutSession, b: WorkoutSession) => b.startedAt - a.startedAt;
const sortMeasurements = (a: Measurement, b: Measurement) => a.date.localeCompare(b.date);
const sortMeals = (a: FoodEntry, b: FoodEntry) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/**
 * Unica fonte dei dati dell'app.
 * - Con account Google: Firestore (con cache offline), condiviso tra dispositivi.
 * - Senza account: localStorage sul dispositivo.
 * Al primo accesso con Google, i dati locali vengono caricati nel cloud.
 */
export function useAppData(user: User | null, onError: (msg: string) => void): [AppData, AppDataActions] {
  const [data, setData] = useState<AppData>(() => ({ ready: false, ...loadLocalData(), consent: readLocalConsent() }));
  const uid = user?.uid ?? null;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const fail = useCallback((what: string) => (err: unknown) => {
    console.error(what, err);
    errorRef.current(`${what}: ${err instanceof Error ? err.message : t('errore sconosciuto')}`);
  }, []);

  /* ---------- Modalità ospite ---------- */
  useEffect(() => {
    if (uid) return;
    setData({ ready: true, ...loadLocalData(), consent: readLocalConsent() });
  }, [uid]);

  /* ---------- Modalità cloud ---------- */
  useEffect(() => {
    if (!uid) return;
    setData((d) => ({ ...d, ready: false }));
    const userRef = doc(db, 'users', uid);
    let cancelled = false;

    // Migrazione dei dati locali (anche quelli della versione precedente)
    (async () => {
      const local = loadLocalData();
      try {
        const snap = await getDoc(userRef);
        if (cancelled) return;
        const remote = snap.data();
        const needsProgram = !remote?.program;
        // il consenso dato senza account passa all'account, se lì non ce n'è già uno
        const localConsent = readLocalConsent();
        const moveConsent = !!localConsent && !normalizeConsent(remote?.consent?.health);
        if (needsProgram || hasLocalActivity(local) || moveConsent) {
          const batch = writeBatch(db);
          batch.set(
            userRef,
            {
              ...(needsProgram ? { program: local.program } : {}),
              ...(!remote?.dietPlan && local.dietPlan ? { dietPlan: local.dietPlan } : {}),
              ...(!remote?.spreadsheetId && local.spreadsheetId ? { spreadsheetId: local.spreadsheetId } : {}),
              ...(!remote?.savedMeals && local.savedMeals.length ? { savedMeals: local.savedMeals } : {}),
              ...(Object.keys(local.water).length ? { water: local.water } : {}),
              ...(moveConsent ? { consent: { health: localConsent } } : {}),
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          );
          local.sessions.forEach((s) => batch.set(doc(db, 'users', uid, 'sessions', s.id), { ...s, userId: uid }));
          local.measurements.forEach((m) => batch.set(doc(db, 'users', uid, 'measurements', m.id), { ...m, userId: uid }));
          local.meals.forEach((m) => batch.set(doc(db, 'users', uid, 'meals', m.id), { ...m, userId: uid }));
          await batch.commit();
          clearLocalData();
        }
        if (localConsent) clearLocalConsent();
      } catch (err) {
        fail(t('Sincronizzazione iniziale non riuscita'))(err);
      }
    })();

    const unsubs = [
      onSnapshot(
        userRef,
        (snap) => {
          const d = snap.data();
          setData((prev) => ({
            ...prev,
            ready: true,
            program: d?.program ? normalizeProgram(d.program) : prev.program,
            dietPlan: normalizeDietPlan(d?.dietPlan),
            spreadsheetId: typeof d?.spreadsheetId === 'string' ? d.spreadsheetId : '',
            savedMeals: normalizeSavedMeals(d?.savedMeals),
            water: normalizeWater(d?.water),
            consent: normalizeConsent(d?.consent?.health)
          }));
        },
        fail(t('Lettura del profilo non riuscita'))
      ),
      onSnapshot(
        collection(db, 'users', uid, 'sessions'),
        (snap) => {
          const sessions = snap.docs.map((d) => normalizeSession(d.data(), d.id)).sort(sortSessions);
          setData((prev) => ({ ...prev, sessions }));
        },
        fail(t('Lettura degli allenamenti non riuscita'))
      ),
      onSnapshot(
        collection(db, 'users', uid, 'measurements'),
        (snap) => {
          const measurements = snap.docs.map((d) => normalizeMeasurement(d.data(), d.id)).sort(sortMeasurements);
          setData((prev) => ({ ...prev, measurements }));
        },
        fail(t('Lettura delle misure non riuscita'))
      ),
      onSnapshot(
        collection(db, 'users', uid, 'meals'),
        (snap) => {
          const meals = snap.docs.map((d) => normalizeMeal(d.data(), d.id)).sort(sortMeals);
          setData((prev) => ({ ...prev, meals }));
        },
        fail(t('Lettura dei pasti non riuscita'))
      )
    ];
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [uid, fail]);

  /* ---------- Azioni ----------
   * Le scritture su Firestore non vengono attese: con la cache offline la
   * promessa si risolve solo quando il server conferma, ma lo stato locale
   * si aggiorna subito tramite onSnapshot.
   */
  const updateLocal = useCallback((fn: (d: LocalData) => LocalData) => {
    setData((prev) => {
      const next = fn({
        program: prev.program, sessions: prev.sessions, measurements: prev.measurements, meals: prev.meals, dietPlan: prev.dietPlan,
        spreadsheetId: prev.spreadsheetId, savedMeals: prev.savedMeals, water: prev.water
      });
      saveLocalData(next);
      return { ...prev, ...next };
    });
  }, []);

  const actions: AppDataActions = {
    saveProgram(p) {
      const program = { ...p, updatedAt: new Date().toISOString() };
      if (uid) {
        void setDoc(doc(db, 'users', uid), { program, updatedAt: program.updatedAt }, { merge: true }).catch(fail(t('Salvataggio della scheda non riuscito')));
        setData((d) => ({ ...d, program }));
      } else updateLocal((d) => ({ ...d, program }));
    },
    addSession(s) {
      if (uid) void setDoc(doc(db, 'users', uid, 'sessions', s.id), { ...s, userId: uid }).catch(fail(t("Salvataggio dell'allenamento non riuscito")));
      else updateLocal((d) => ({ ...d, sessions: [s, ...d.sessions].sort(sortSessions) }));
    },
    updateSession(id, patch) {
      if (uid) void setDoc(doc(db, 'users', uid, 'sessions', id), { ...patch, userId: uid }, { merge: true }).catch(fail(t('Aggiornamento non riuscito')));
      else updateLocal((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    },
    deleteSession(id) {
      if (uid) void deleteDoc(doc(db, 'users', uid, 'sessions', id)).catch(fail(t('Eliminazione non riuscita')));
      else updateLocal((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
    },
    addMeasurement(m) {
      if (uid) void setDoc(doc(db, 'users', uid, 'measurements', m.id), { ...m, userId: uid }).catch(fail(t('Salvataggio della misura non riuscito')));
      else updateLocal((d) => ({ ...d, measurements: [...d.measurements, m].sort(sortMeasurements) }));
    },
    updateMeasurement(id, patch) {
      if (uid) void setDoc(doc(db, 'users', uid, 'measurements', id), { ...patch, userId: uid }, { merge: true }).catch(fail(t('Aggiornamento non riuscito')));
      else updateLocal((d) => ({ ...d, measurements: d.measurements.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    },
    deleteMeasurement(id) {
      if (uid) void deleteDoc(doc(db, 'users', uid, 'measurements', id)).catch(fail(t('Eliminazione non riuscita')));
      else updateLocal((d) => ({ ...d, measurements: d.measurements.filter((m) => m.id !== id) }));
    },
    addMeal(m) {
      if (uid) void setDoc(doc(db, 'users', uid, 'meals', m.id), { ...m, userId: uid }).catch(fail(t('Salvataggio del pasto non riuscito')));
      else updateLocal((d) => ({ ...d, meals: [...d.meals, m].sort(sortMeals) }));
    },
    updateMeal(id, patch) {
      if (uid) void setDoc(doc(db, 'users', uid, 'meals', id), { ...patch, userId: uid }, { merge: true }).catch(fail(t('Aggiornamento del pasto non riuscito')));
      else updateLocal((d) => ({ ...d, meals: d.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    },
    deleteMeal(id) {
      if (uid) void deleteDoc(doc(db, 'users', uid, 'meals', id)).catch(fail(t('Eliminazione non riuscita')));
      else updateLocal((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
    },
    saveDietPlan(plan) {
      const next = plan ? { ...plan, updatedAt: new Date().toISOString() } : null;
      if (uid) {
        void setDoc(doc(db, 'users', uid), { dietPlan: next }, { merge: true }).catch(fail(t('Salvataggio della dieta non riuscito')));
        setData((d) => ({ ...d, dietPlan: next }));
      } else updateLocal((d) => ({ ...d, dietPlan: next }));
    },
    saveSavedMeals(list) {
      if (uid) {
        void setDoc(doc(db, 'users', uid), { savedMeals: list }, { merge: true }).catch(fail(t('Salvataggio dei pasti salvati non riuscito')));
        setData((d) => ({ ...d, savedMeals: list }));
      } else updateLocal((d) => ({ ...d, savedMeals: list }));
    },
    setWater(date, ml) {
      const value = Math.max(0, Math.round(ml));
      const apply = (w: WaterLog): WaterLog => {
        const next = { ...w };
        if (value > 0) next[date] = value;
        else delete next[date];
        return next;
      };
      if (uid) {
        void setDoc(doc(db, 'users', uid), { water: { [date]: value > 0 ? value : deleteField() } }, { merge: true }).catch(fail(t("Salvataggio dell'acqua non riuscito")));
        setData((d) => ({ ...d, water: apply(d.water) }));
      } else updateLocal((d) => ({ ...d, water: apply(d.water) }));
    },
    setSpreadsheetId(id) {
      if (uid) void setDoc(doc(db, 'users', uid), { spreadsheetId: id }, { merge: true }).catch(fail(t('Salvataggio del foglio non riuscito')));
      else updateLocal((d) => ({ ...d, spreadsheetId: id }));
    },
    saveHealthConsent(c) {
      if (uid) {
        void setDoc(doc(db, 'users', uid), { consent: { health: c ?? deleteField() } }, { merge: true }).catch(fail(t('Salvataggio del consenso non riuscito')));
      } else if (c) writeLocalConsent(c);
      else clearLocalConsent();
      setData((d) => ({ ...d, consent: c }));
    },
    async importAll(incoming) {
      const program = normalizeProgram(incoming.program);
      const sessions = (incoming.sessions ?? []).map((s) => normalizeSession(s as never));
      const measurements = (incoming.measurements ?? []).map((m) => normalizeMeasurement(m as never));
      const meals = (incoming.meals ?? []).map((m) => normalizeMeal(m as never));
      const dietPlan = normalizeDietPlan(incoming.dietPlan);
      const savedMeals = normalizeSavedMeals(incoming.savedMeals);
      const water = normalizeWater(incoming.water);
      if (uid) {
        // i batch di Firestore accettano al massimo 500 scritture
        const writes: [string[], object][] = [
          [['users', uid], { program, dietPlan, spreadsheetId: incoming.spreadsheetId ?? '', savedMeals, water, updatedAt: new Date().toISOString() }],
          ...sessions.map((s): [string[], object] => [['users', uid, 'sessions', s.id], { ...s, userId: uid }]),
          ...measurements.map((m): [string[], object] => [['users', uid, 'measurements', m.id], { ...m, userId: uid }]),
          ...meals.map((m): [string[], object] => [['users', uid, 'meals', m.id], { ...m, userId: uid }])
        ];
        for (let i = 0; i < writes.length; i += 450) {
          const batch = writeBatch(db);
          writes.slice(i, i + 450).forEach(([path, value]) => {
            const [first, ...rest] = path;
            batch.set(doc(db, first, ...rest), value, { merge: true });
          });
          await batch.commit();
        }
      } else {
        updateLocal(() => ({ program, sessions: sessions.sort(sortSessions), measurements: measurements.sort(sortMeasurements), meals: meals.sort(sortMeals), dietPlan, spreadsheetId: incoming.spreadsheetId ?? '', savedMeals, water }));
      }
    }
  };

  return [data, actions];
}
