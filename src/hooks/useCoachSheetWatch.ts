import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { WorkoutProgram } from '../types';
import { readTab } from '../services/googleSheets';
import { authErrorMessage, withGoogleToken } from '../services/firebase';
import { parseCoachSheet } from '../lib/coachSheet';
import { prepareImported } from '../lib/coachImport';
import { diffPrograms, programFingerprint, type ProgramChange } from '../lib/programDiff';
import { loadLibrary } from '../lib/exerciseLibrary';

/** ogni quanto ricontrollare il foglio quando si torna nell'app */
const EVERY_MS = 10 * 60 * 1000;

export type CoachWatchStatus = 'idle' | 'checking' | 'needsAuth' | 'uptodate' | 'changed' | 'error';

export interface CoachWatch {
  status: CoachWatchStatus;
  changes: ProgramChange[];
  checkedAt: number | null;
  error: string;
  /** interactive=true dopo un tocco: se serve chiede il permesso Google */
  check: (interactive: boolean) => Promise<void>;
  /** sostituisce la scheda con quella del foglio */
  apply: () => Promise<void>;
  /** non avvisare più per questa versione del foglio */
  dismiss: () => void;
}

interface Args {
  user: User | null;
  spreadsheetId: string;
  program: WorkoutProgram;
  onSaveProgram: (p: WorkoutProgram) => void;
}

/**
 * Controlla se il coach ha modificato la scheda nel foglio Google: all'apertura dell'app e quando ci si torna.
 * Funziona solo con il permesso Google ancora valido (circa un'ora); altrimenti aspetta un tocco.
 * Non cambia niente da solo: mostra le differenze e aspetta che l'utente aggiorni.
 */
export function useCoachSheetWatch({ user, spreadsheetId, program, onSaveProgram }: Args): CoachWatch {
  const [status, setStatus] = useState<CoachWatchStatus>('idle');
  const [changes, setChanges] = useState<ProgramChange[]>([]);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const latest = useRef<{ parsed: WorkoutProgram; fingerprint: string } | null>(null);
  const busy = useRef(false);
  const programRef = useRef(program);
  programRef.current = program;
  const saveRef = useRef(onSaveProgram);
  saveRef.current = onSaveProgram;

  const tab = program.source?.tab ?? '';
  const enabled = !!user && !!spreadsheetId && !!tab;

  const check = useCallback(async (interactive: boolean) => {
    if (!enabled || busy.current) return;
    busy.current = true;
    setStatus('checking');
    setError('');
    try {
      const rows = await withGoogleToken((t) => readTab(t, spreadsheetId, tab), interactive);
      if (!rows) {
        setStatus('needsAuth');
        return;
      }
      const parsed = parseCoachSheet(rows, tab).program;
      const fingerprint = programFingerprint(parsed);
      setCheckedAt(Date.now());
      const current = programRef.current;
      if (fingerprint === current.source?.fingerprint) {
        latest.current = null;
        setChanges([]);
        setStatus('uptodate');
        return;
      }
      const diff = diffPrograms(current, parsed);
      if (!diff.length) {
        // stessa scheda (per esempio importata prima che esistesse l'impronta): la si segna come vista
        if (current.source) saveRef.current({ ...current, source: { ...current.source, fingerprint } });
        latest.current = null;
        setChanges([]);
        setStatus('uptodate');
        return;
      }
      latest.current = { parsed, fingerprint };
      setChanges(diff);
      setStatus('changed');
    } catch (err) {
      setError(authErrorMessage(err));
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }, [enabled, spreadsheetId, tab]);

  const apply = useCallback(async () => {
    const found = latest.current;
    const current = programRef.current;
    if (!found) return;
    const library = await loadLibrary().catch(() => []);
    saveRef.current(prepareImported(found.parsed, current, library, { measuresTab: current.source?.measuresTab, annotate: current.source?.annotate }));
    latest.current = null;
    setChanges([]);
    setStatus('uptodate');
  }, []);

  const dismiss = useCallback(() => {
    const found = latest.current;
    const current = programRef.current;
    if (found && current.source) saveRef.current({ ...current, source: { ...current.source, fingerprint: found.fingerprint } });
    latest.current = null;
    setChanges([]);
    setStatus('uptodate');
  }, []);

  // se la scheda viene riletta a mano (o su un altro dispositivo) l'avviso non serve più
  const savedFingerprint = program.source?.fingerprint;
  useEffect(() => {
    if (latest.current && latest.current.fingerprint === savedFingerprint) {
      latest.current = null;
      setChanges([]);
      setStatus('uptodate');
    }
  }, [savedFingerprint]);

  // all'apertura e quando cambia il foglio collegato
  useEffect(() => {
    if (enabled) void check(false);
    else {
      latest.current = null;
      setChanges([]);
      setStatus('idle');
    }
  }, [enabled, check]);

  // tornando nell'app, se è passato un po'
  const checkedRef = useRef(checkedAt);
  checkedRef.current = checkedAt;
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - (checkedRef.current ?? 0) > EVERY_MS) void check(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, check]);

  return { status, changes, checkedAt, error, check, apply, dismiss };
}
