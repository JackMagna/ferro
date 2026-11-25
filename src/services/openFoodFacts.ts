import { readJSON, writeJSON } from '../lib/storage';
import { parseOffProduct, type OffProduct } from '../lib/offMap';
import { t } from '../lib/i18n';

/**
 * Open Food Facts (dati aperti, nessuna chiave). Limiti indicati nella documentazione:
 * ricerca 10 richieste/minuto, lettura di un prodotto 100/minuto. Per questo la ricerca parte solo da un pulsante
 * e i prodotti già letti si tengono in una cache locale.
 */
const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_it,brands,nutriments,nutriscore_grade,nova_group,serving_quantity';
export const CACHE_KEY = 'irontrack:off-cache';
const CACHE_MAX = 200;

interface CacheItem { code: string; product: OffProduct }

const readCache = () => readJSON<CacheItem[]>(CACHE_KEY, []);
function remember(product: OffProduct) {
  const list = [{ code: product.code, product }, ...readCache().filter((c) => c.code !== product.code)].slice(0, CACHE_MAX);
  writeJSON(CACHE_KEY, list);
}

export class OffUnavailableError extends Error {
  constructor(detail = '') {
    super(t('Open Food Facts non risponde{detail}. Riprova più tardi o inserisci i valori a mano.', { detail: detail ? ` (${detail})` : '' }));
    this.name = 'OffUnavailableError';
  }
}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new OffUnavailableError(t('rete o blocco del browser'));
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new Error(t('Open Food Facts ha limitato le richieste: aspetta un minuto e riprova.'));
  if (!res.ok) throw new OffUnavailableError(String(res.status));
  return res.json().catch(() => null);
}

/** Prodotto dal codice a barre (EAN/UPC). Null se non esiste o non ha dati nutrizionali. */
export async function fetchProduct(barcode: string): Promise<OffProduct | null> {
  const code = barcode.replace(/\D/g, '');
  if (!/^\d{6,14}$/.test(code)) return null;
  const cached = readCache().find((c) => c.code === code);
  if (cached) return cached.product;
  const json = (await getJson(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`)) as { status?: number; product?: unknown } | null;
  if (!json || json.status === 0 || !json.product) return null;
  const product = parseOffProduct({ code, ...(json.product as object) });
  if (product) remember(product);
  return product;
}

/** Ricerca per nome: da chiamare solo su azione dell'utente (limite di 10 al minuto). */
export async function searchProducts(text: string): Promise<OffProduct[]> {
  const q = text.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '10', fields: FIELDS });
  const json = (await getJson(`${BASE}/cgi/search.pl?${params}`)) as { products?: unknown[] } | null;
  const out = (json?.products ?? []).flatMap((p) => {
    const parsed = parseOffProduct(p);
    return parsed ? [parsed] : [];
  });
  out.forEach(remember);
  return out;
}
