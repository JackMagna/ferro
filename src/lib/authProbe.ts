/**
 * Diagnostica dell'accesso all'avvio. Serve a capire perché l'app installata a volte riparte dalla schermata di accesso.
 * Prima che Firebase parta si guarda se sul dispositivo c'è un accesso salvato (database IndexedDB di Firebase Auth);
 * poi si annota cosa risponde Firebase e dopo quanto. Restano gli ultimi avvii, solo su questo dispositivo.
 * Nessun dato personale: solo sì/no, tempi e modalità di apertura.
 */
import { readJSON, writeJSON } from './storage';

const LOG_KEY = 'irontrack:auth-log';
const MAX_ENTRIES = 12;
const FIREBASE_DB = 'firebaseLocalStorageDb';
const FIREBASE_STORE = 'firebaseLocalStorage';
const USER_PREFIX = 'firebase:authUser:';

export interface AuthLogEntry {
  /** data e ora dell'avvio */
  at: string;
  /** aperta come app installata (non in una scheda del browser) */
  installed: boolean;
  /** c'era un accesso salvato prima dell'avvio (null: non verificabile) */
  stored: boolean | null;
  /** quante chiavi irontrack:* c'erano in localStorage: 0 vuol dire dati del sito cancellati */
  localKeys: number;
  /** cosa ha risposto Firebase */
  result?: 'connesso' | 'non connesso';
  /** millisecondi dalla partenza alla risposta di Firebase */
  ms?: number;
}

const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function isInstalled(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function countLocalKeys(): number {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith('irontrack:') && k !== LOG_KEY).length;
  } catch {
    return 0;
  }
}

/** C'è un utente salvato da Firebase Auth? Non crea il database se non esiste. */
async function readStoredUser(): Promise<boolean | null> {
  try {
    if (Object.keys(localStorage).some((k) => k.startsWith(USER_PREFIX))) return true;
  } catch {
    /* localStorage non disponibile */
  }
  if (typeof indexedDB === 'undefined') return null;
  try {
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === FIREBASE_DB)) return false;
    }
    return await new Promise<boolean | null>((resolve) => {
      const req = indexedDB.open(FIREBASE_DB);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        // il database non c'era (browser senza indexedDB.databases): lo si lascia creare a Firebase
        req.transaction?.abort();
        resolve(false);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          if (!db.objectStoreNames.contains(FIREBASE_STORE)) {
            db.close();
            resolve(false);
            return;
          }
          const keys = db.transaction(FIREBASE_STORE, 'readonly').objectStore(FIREBASE_STORE).getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result.some((k) => String(k).startsWith(USER_PREFIX)));
          };
          keys.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    });
  } catch {
    return null;
  }
}

const entry: AuthLogEntry = { at: new Date().toISOString(), installed: isInstalled(), stored: null, localKeys: countLocalKeys() };

/** Avviato all'importazione del modulo, prima che Firebase Auth legga il proprio database. */
export const storedUserCheck: Promise<boolean | null> = readStoredUser().then((stored) => {
  entry.stored = stored;
  save();
  return stored;
});

function save() {
  const log = readJSON<AuthLogEntry[]>(LOG_KEY, []).filter((e) => e.at !== entry.at);
  writeJSON(LOG_KEY, [...log, { ...entry }].slice(-MAX_ENTRIES));
}

let recorded = false;
/** Prima risposta di Firebase dopo l'avvio. */
export function recordAuthResult(signedIn: boolean) {
  if (recorded) return;
  recorded = true;
  entry.result = signedIn ? 'connesso' : 'non connesso';
  entry.ms = Math.round(now() - startedAt);
  void storedUserCheck.then(save);
}

export function authLog(): AuthLogEntry[] {
  return readJSON<AuthLogEntry[]>(LOG_KEY, []);
}

/** Testo leggibile da copiare e mandare. */
export function authLogText(log: AuthLogEntry[] = authLog()): string {
  return log
    .map((e) => {
      const when = new Date(e.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const stored = e.stored === null ? 'accesso salvato: ?' : e.stored ? 'accesso salvato: sì' : 'accesso salvato: no';
      const result = e.result ? `${e.result} in ${((e.ms ?? 0) / 1000).toFixed(1)} s` : 'nessuna risposta';
      return `${when} · ${e.installed ? 'app installata' : 'browser'} · ${stored} · dati locali: ${e.localKeys} · ${result}`;
    })
    .join('\n');
}
