import { arrayUnion, collection, doc, getDocs, limit, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { linkKey, tallyVotes, type LinkTally } from '../lib/exerciseLinks';
import { readJSON, writeJSON } from '../lib/storage';

/**
 * Voti condivisi sui collegamenti esercizio ↔ libreria (Firestore):
 *   exerciseLinks/{chiave del nome}/votes/{uid} = { name, libraryId, previous, at }
 * Un voto per utente e per nome (si sovrascrive), leggibile da chi ha un account, scrivibile solo dal proprietario.
 * Le chiavi votate stanno anche in users/{uid}.linkVotes, così l'eliminazione dell'account le ritrova.
 * Senza account non si vota e non si leggono i voti. Se le regole non lo consentono, si ignora in silenzio.
 */

const CACHE_KEY = 'irontrack:link-votes';
const CACHE_MS = 3 * 86_400_000;
const MAX_VOTES = 200;

interface Cached { at: number; tally: LinkTally[] }

/** Registra la scelta dell'utente: libraryId undefined = «nessun esercizio della libreria va bene». */
export async function shareLink(name: string, libraryId: string | undefined, previous: string | undefined): Promise<void> {
  const user = auth.currentUser;
  const key = linkKey(name);
  if (!user || !key) return;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'exerciseLinks', key, 'votes', user.uid), {
      name: name.trim().slice(0, 120),
      libraryId: libraryId ?? '',
      previous: previous ?? '',
      at: serverTimestamp()
    });
    batch.set(doc(db, 'users', user.uid), { linkVotes: arrayUnion(key) }, { merge: true });
    await batch.commit();
    const cache = readJSON<Record<string, Cached>>(CACHE_KEY, {});
    delete cache[key];
    writeJSON(CACHE_KEY, cache);
  } catch (err) {
    console.warn('Voto sul collegamento non salvato', err);
  }
}

/** Voti degli utenti per un nome (in cache per qualche giorno). null se non disponibili. */
export async function linkVotes(name: string, fresh = false): Promise<LinkTally[] | null> {
  const key = linkKey(name);
  if (!auth.currentUser || !key) return null;
  const cache = readJSON<Record<string, Cached>>(CACHE_KEY, {});
  const hit = cache[key];
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.tally;
  try {
    const snap = await getDocs(query(collection(db, 'exerciseLinks', key, 'votes'), limit(MAX_VOTES)));
    const tally = tallyVotes(snap.docs.map((d) => ({ libraryId: String(d.get('libraryId') ?? '') })));
    cache[key] = { at: Date.now(), tally };
    writeJSON(CACHE_KEY, cache);
    return tally;
  } catch (err) {
    console.warn('Voti sui collegamenti non letti', err);
    return null;
  }
}
