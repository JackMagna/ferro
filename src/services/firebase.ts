import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../../firebase-applet-config.json';
import { readJSON, removeKey, writeJSON } from '../lib/storage';
import { t } from '../lib/i18n';
// prima di getAuth: guarda se c'è un accesso salvato, per la diagnostica e per non mostrare l'accesso troppo presto
import '../lib/authProbe';

/**
 * Test automatici (VITE_FIREBASE_EMULATOR=1): accesso e database sono gli emulatori Firebase su questo PC,
 * con un progetto finto «demo-ferro». Nessun dato vero e nessun account Google vero.
 */
const EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export const app = initializeApp(EMULATOR ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-ferro', appId: 'demo-app' } : firebaseConfig);
export const auth = getAuth(app);
if (EMULATOR) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

/**
 * Cache locale persistente: l'app funziona offline e le scritture vengono
 * inviate quando torna la rete. ignoreUndefinedProperties evita errori
 * sui campi facoltativi lasciati vuoti.
 */
export const db = initializeFirestore(
  app,
  {
    ignoreUndefinedProperties: true,
    // alcune reti mobili bloccano lo streaming: in quel caso passa a richieste normali
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  },
  EMULATOR ? undefined : (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId
);
if (EMULATOR) connectFirestoreEmulator(db, '127.0.0.1', 8080);

/**
 * Il login Firebase non conserva il token OAuth di Google: dura circa un'ora e si perde ricaricando la pagina.
 * Ogni servizio (Sheets, Google Health) ha i suoi permessi e il suo token, salvato con la scadenza.
 * Quando scade si ricollega Google con un tocco (popup).
 */
export type GoogleService = 'sheets' | 'health';

const HEALTH = 'https://www.googleapis.com/auth/googlehealth';
export const SCOPES: Record<GoogleService, string[]> = {
  sheets: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
  health: [
    `${HEALTH}.health_metrics_and_measurements.readonly`, // legge peso, massa grassa, frequenza cardiaca
    `${HEALTH}.health_metrics_and_measurements.writeonly`, // scrive peso e massa grassa
    `${HEALTH}.activity_and_fitness.writeonly`, // registra gli allenamenti
    `${HEALTH}.nutrition.writeonly` // registra i pasti
  ]
};

function provider(service?: GoogleService) {
  const p = new GoogleAuthProvider();
  if (service) SCOPES[service].forEach((s) => p.addScope(s));
  return p;
}

const TOKEN_TTL_MS = 55 * 60 * 1000;
const tokenKey = (service: GoogleService) => `irontrack:google-token:${service}`;

interface StoredToken {
  token: string;
  expiresAt: number;
  uid: string;
}

export function getValidGoogleToken(service: GoogleService = 'sheets'): string | null {
  const stored = readJSON<StoredToken | null>(tokenKey(service), null);
  if (!stored || stored.uid !== auth.currentUser?.uid) return null;
  return stored.expiresAt > Date.now() + 30_000 ? stored.token : null;
}

function storeToken(service: GoogleService, user: User, token: string | undefined) {
  if (token) writeJSON(tokenKey(service), { token, uid: user.uid, expiresAt: Date.now() + TOKEN_TTL_MS } satisfies StoredToken);
}

export class GoogleTokenExpiredError extends Error {
  constructor() {
    super(t('Il collegamento con Google è scaduto. Tocca "Ricollega Google" e riprova.'));
    this.name = 'GoogleTokenExpiredError';
  }
}

/* ---------- app Android: accesso Google nativo ---------- */
// Nella WebView di Android il popup di Google non funziona: si usa l'accesso del sistema
// (Credential Manager, plugin @capgo/capacitor-social-login) e poi si entra in Firebase con le stesse credenziali.
// Serve l'ID client OAuth di tipo «Applicazione web» del progetto (non è un segreto): VITE_GOOGLE_WEB_CLIENT_ID.
const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
let nativeReady: Promise<void> | null = null;

/**
 * Test nell'app Android (solo con VITE_FIREBASE_EMULATOR=1): al posto dell'accesso Google del sistema,
 * un token finto che l'emulatore di Authentication accetta. L'utente lo sceglie il test in localStorage.
 */
function emulatorGoogleToken(): string {
  const u = readJSON<{ email: string; name: string } | null>('irontrack:test-google-user', null) ?? { email: 'mario.prova@example.com', name: 'Mario Prova' };
  return JSON.stringify({ sub: u.email, email: u.email, name: u.name, email_verified: true });
}

async function nativeGoogle(scopes: string[]): Promise<{ idToken: string | null; accessToken?: string }> {
  if (EMULATOR) return { idToken: emulatorGoogleToken(), accessToken: scopes.length ? 'token-di-prova' : undefined };
  // ID client OAuth «Applicazione web» del progetto: è già nella configurazione Firebase (non è un segreto);
  // la variabile d'ambiente serve solo per usarne un altro.
  const webClientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) || (firebaseConfig as { oAuthClientId?: string }).oAuthClientId;
  if (!webClientId) throw new Error(t("L'accesso con Google nell'app Android non è ancora configurato."));
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  nativeReady ??= SocialLogin.initialize({ google: { webClientId } });
  await nativeReady;
  let res;
  try {
    res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile', ...scopes] } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg)) throw Object.assign(new Error(t('Accesso annullato.')), { code: 'auth/popup-closed-by-user' });
    // di solito: firma dell'app (SHA-1) non registrata nel client OAuth Android del progetto
    throw new Error(t("Accesso con Google non riuscito nell'app Android ({motivo}). Se persiste, usa Ferro dal browser.", { motivo: msg }));
  }
  const r = res.result as { idToken?: string | null; accessToken?: { token?: string } | null };
  return { idToken: r.idToken ?? null, accessToken: r.accessToken?.token };
}

async function nativeSignIn(scopes: string[]): Promise<{ user: User; accessToken?: string }> {
  const { idToken, accessToken } = await nativeGoogle(scopes);
  if (auth.currentUser) return { user: auth.currentUser, accessToken };
  if (!idToken && !accessToken) throw new Error(t('Google non ha restituito le credenziali.'));
  const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
  return { user: result.user, accessToken };
}

/**
 * Nell'app Android Google può restituire un token senza alcuni permessi (caselle non spuntate, o un permesso
 * dato prima e riusato): lo si controlla subito, così l'errore dice cosa manca invece di un generico «accesso negato».
 */
async function checkGrantedScopes(token: string, wanted: string[]) {
  let granted: string[];
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return; // controllo non disponibile: si prova comunque
    granted = String((await res.json()).scope ?? '').split(' ');
  } catch {
    return;
  }
  const missing = wanted.filter((s) => !granted.includes(s));
  if (missing.length) {
    const names = missing.map((s) => s.replace(/^https:\/\/www\.googleapis\.com\/auth\//, '')).join(', ');
    throw new Error(t('Google non ha concesso tutti i permessi (mancano: {nomi}). Riprova e spunta tutte le caselle; se non compaiono, revoca Ferro in myaccount.google.com → Sicurezza → App di terze parti e ricollega.', { nomi: names }));
  }
}

/** Accesso con Google. I permessi per Sheets o Google Health si chiedono solo quando servono. */
export async function signInWithGoogle(service?: GoogleService): Promise<User> {
  if (isNativeApp()) {
    const { user, accessToken } = await nativeSignIn(service ? SCOPES[service] : []);
    if (service && accessToken) await checkGrantedScopes(accessToken, SCOPES[service]);
    if (service) storeToken(service, user, accessToken);
    return user;
  }
  const result = await signInWithPopup(auth, provider(service));
  if (service) storeToken(service, result.user, GoogleAuthProvider.credentialFromResult(result)?.accessToken);
  return result.user;
}

/** Ottiene un token valido per il servizio, aprendo il popup di Google solo se necessario. */
export async function ensureGoogleToken(service: GoogleService = 'sheets'): Promise<string> {
  const existing = getValidGoogleToken(service);
  if (existing) return existing;
  if (isNativeApp()) {
    const { user, accessToken } = await nativeSignIn(SCOPES[service]);
    if (!accessToken) throw new Error(t('Google non ha restituito il permesso richiesto.'));
    await checkGrantedScopes(accessToken, SCOPES[service]);
    storeToken(service, user, accessToken);
    return accessToken;
  }
  const user = auth.currentUser;
  const result = user
    ? await reauthenticateWithPopup(user, provider(service))
    : await signInWithPopup(auth, provider(service));
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error(t('Google non ha restituito il permesso richiesto.'));
  storeToken(service, result.user, token);
  return token;
}

/**
 * Esegue una chiamata Google con il token giusto.
 * - interactive=true: se serve apre il popup di Google (da usare dopo un tocco dell'utente).
 * - interactive=false: non apre nulla; se il token è scaduto restituisce undefined.
 */
export async function withGoogleToken<T>(fn: (token: string) => Promise<T>, interactive = true, service: GoogleService = 'sheets'): Promise<T | undefined> {
  const quiet = getValidGoogleToken(service);
  if (!interactive && !quiet) return undefined;
  try {
    return await fn(quiet ?? (await ensureGoogleToken(service)));
  } catch (err) {
    if (!(err instanceof GoogleTokenExpiredError)) throw err;
    clearGoogleToken(service);
    if (!interactive) return undefined;
    return fn(await ensureGoogleToken(service));
  }
}

export function clearGoogleToken(service?: GoogleService) {
  (service ? [service] : (['sheets', 'health'] as GoogleService[])).forEach((s) => removeKey(tokenKey(s)));
}

export async function logout() {
  clearGoogleToken();
  if (isNativeApp()) {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');
    await SocialLogin.logout({ provider: 'google' }).catch(() => undefined);
  }
  await signOut(auth);
}

/**
 * Elimina l'account: riautentica con Google (l'eliminazione lo richiede), cancella i voti sui collegamenti
 * degli esercizi, sessioni, misure, pasti e il documento utente su Firestore, poi l'utente di Firebase Auth e i dati locali.
 * Le regole Firestore devono consentire `delete` sul documento users/{uid}.
 */
export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error(t('Nessun account connesso.'));
  if (isNativeApp()) {
    const { idToken, accessToken } = await nativeGoogle([]);
    if (!idToken && !accessToken) throw new Error(t('Google non ha restituito le credenziali.'));
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken, accessToken));
  } else {
    await reauthenticateWithPopup(user, provider());
  }
  const userRef = doc(db, 'users', user.uid);
  // voti sui collegamenti degli esercizi (exerciseLinks/{chiave}/votes/{uid}), elencati in linkVotes
  const voted = ((await getDoc(userRef)).get('linkVotes') as unknown[] | undefined) ?? [];
  const voteKeys = voted.filter((k): k is string => typeof k === 'string' && k.length > 0);
  for (let i = 0; i < voteKeys.length; i += 400) {
    const batch = writeBatch(db);
    voteKeys.slice(i, i + 400).forEach((k) => batch.delete(doc(db, 'exerciseLinks', k, 'votes', user.uid)));
    await batch.commit();
  }
  for (const name of ['sessions', 'measurements', 'meals']) {
    const snap = await getDocs(collection(userRef, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(userRef);
  await deleteUser(user);
  clearLocalData();
}

/** Cancella tutto ciò che Ferro tiene su questo dispositivo (chiavi irontrack:*). */
export function clearLocalData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('irontrack:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* archivio locale non disponibile */
  }
}

export function watchAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

/** Messaggio leggibile per gli errori di accesso più comuni */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return t('Accesso annullato.');
  if (code.includes('popup-blocked')) return t('Il browser ha bloccato il popup di Google. Consenti i popup per questo sito e riprova.');
  if (code.includes('unauthorized-domain')) return t('Questo dominio non è autorizzato in Firebase. Aggiungilo in Authentication > Impostazioni > Domini autorizzati.');
  if (code.includes('network')) return t('Nessuna connessione. Riprova quando sei online.');
  return err instanceof Error ? err.message : t('Accesso non riuscito.');
}
