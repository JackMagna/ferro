import { expect, type Page } from '@playwright/test';

/** Accesso agli emulatori Firebase dai test: pulizia, utenti e documenti (letti come amministratore, senza regole). */
export const PROJECT = 'demo-ferro';
const AUTH = 'http://127.0.0.1:9099';
const FS = 'http://127.0.0.1:8080';
const DOCS = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner' };

/** Svuota database e utenti: ogni test parte da zero. */
export async function resetEmulators() {
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

export interface TestUser { email: string; name: string }
export const MARIO: TestUser = { email: 'mario.prova@example.com', name: 'Mario Prova' };
export const LUCIA: TestUser = { email: 'lucia.prova@example.com', name: 'Lucia Prova' };

/** Utenti presenti nell'emulatore di Authentication. */
export async function authUsers(): Promise<{ localId: string; email?: string; displayName?: string }[]> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: 'POST',
    headers: { ...OWNER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUserInfo: true })
  });
  return ((await res.json()).userInfo ?? []) as { localId: string; email?: string }[];
}

export async function uidOf(user: TestUser): Promise<string> {
  const found = (await authUsers()).find((u) => u.email === user.email);
  if (!found) throw new Error(`Utente ${user.email} non trovato nell'emulatore`);
  return found.localId;
}

/** Valore Firestore (formato REST) → valore JavaScript. */
type FsValue = Record<string, unknown>;
function decode(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  return undefined;
}
const decodeFields = (fields: Record<string, FsValue>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));

/** Documento Firestore come oggetto, o null se non esiste. */
export async function getDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${DOCS}/${path}`, { headers: OWNER });
  if (res.status === 404) return null;
  const body = await res.json();
  return decodeFields(body.fields ?? {});
}

/** Documenti di una raccolta (id → dati). */
export async function listDocs(path: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const res = await fetch(`${DOCS}/${path}?pageSize=300`, { headers: OWNER });
  const body = await res.json();
  return ((body.documents ?? []) as { name: string; fields?: Record<string, FsValue> }[]).map((d) => ({ id: d.name.split('/').pop()!, data: decodeFields(d.fields ?? {}) }));
}

/**
 * Accesso con Google tramite la finestra dell'emulatore. Si ferma se la finestra non è quella dell'emulatore:
 * vuol dire che l'app sta usando il Firebase vero (server avviato senza VITE_FIREBASE_EMULATOR=1).
 */
export async function loginWithGoogle(page: Page, user: TestUser = MARIO, button = page.getByRole('button', { name: 'Accedi con Google' }).first()) {
  const popupPromise = page.waitForEvent('popup');
  await button.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url(), 'La finestra di accesso deve essere quella dell\'emulatore, non Google vero').toContain('127.0.0.1:9099');
  const existing = popup.getByText(user.email);
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
  } else {
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.locator('#email-input').fill(user.email);
    await popup.locator('#display-name-input').fill(user.name);
    await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
  }
  await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toContainText(user.name.split(' ')[0]);
}

/** Token Google finto per Sheets: l'app lo usa senza aprire il popup (le chiamate a Sheets sono simulate). */
export async function grantSheetsToken(page: Page, user: TestUser = MARIO) {
  const uid = await uidOf(user);
  await page.evaluate((u) => {
    localStorage.setItem('irontrack:google-token:sheets', JSON.stringify({ token: 'token-di-prova', uid: u, expiresAt: Date.now() + 50 * 60_000 }));
  }, uid);
}
