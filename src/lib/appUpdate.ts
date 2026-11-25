/** Aggiornamenti dell'app Android scaricata dal sito: le versioni pubblicate sono le Release v* del repository. */
export const REPO = 'JackMagna/ferro';
export const REPO_URL = `https://github.com/${REPO}`;
/** Link fisso all'APK dell'ultima versione (lo usa anche il sito). */
export const APK_URL = `${REPO_URL}/releases/latest/download/ferro-release.apk`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())?.slice(1).map(Number);

/** true se `latest` è più nuova di `current`; false se una delle due non è vX.Y.Z (le build di prova). */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** Ultima versione pubblicata se più nuova di quella installata; null se è aggiornata, è una build di prova o manca la rete. */
export async function checkForUpdate(current: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  if (!parse(current)) return null;
  try {
    const r = await fetchFn(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const { tag_name } = (await r.json()) as { tag_name?: string };
    return tag_name && isNewer(tag_name, current) ? tag_name : null;
  } catch {
    return null;
  }
}
