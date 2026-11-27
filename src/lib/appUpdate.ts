/** Aggiornamenti dell'app Android scaricata dal sito: le versioni pubblicate sono le Release v* del repository. */
export const REPO = 'JackMagna/ferro';
export const REPO_URL = `https://github.com/${REPO}`;
/** Link fisso all'APK dell'ultima versione (lo usa anche il sito). */
export const APK_URL = `${REPO_URL}/releases/latest/download/ferro-release.apk`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;

/** APK di una versione precisa: quello che si scarica dall'app (così non cambia se esce un'altra versione a metà download). */
export const apkUrlFor = (tag: string) => `${REPO_URL}/releases/download/${encodeURIComponent(tag)}/ferro-release.apk`;

const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())?.slice(1).map(Number);

/** true se `latest` è più nuova di `current`; false se una delle due non è vX.Y.Z (le build di prova). */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** true per le versioni vere (vX.Y.Z), false per le build di prova. */
export const isRelease = (v: string | undefined): v is string => !!v && !!parse(v);

/** Le prime righe dell'elenco delle novità nella nota della Release, senza il Markdown. */
export function releaseNotes(body: string | undefined, max = 2): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map((l) => /^\s*[-*]\s+(.+)$/.exec(l)?.[1])
    .filter((l): l is string => !!l)
    .map((l) =>
      l
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|__|`/g, '')
        .trim()
    )
    .filter(Boolean)
    .slice(0, max)
    .map((l) => (l.length > 140 ? `${l.slice(0, 139).trimEnd()}…` : l));
}

export interface AppUpdateInfo {
  tag: string;
  notes: string[];
}

/** Ultima versione pubblicata se più nuova di quella installata; null se è aggiornata, è una build di prova o manca la rete. */
export async function checkForUpdate(current: string, fetchFn: typeof fetch = fetch): Promise<AppUpdateInfo | null> {
  if (!parse(current)) return null;
  try {
    const r = await fetchFn(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const { tag_name, body } = (await r.json()) as { tag_name?: string; body?: string };
    return tag_name && isNewer(tag_name, current) ? { tag: tag_name, notes: releaseNotes(body) } : null;
  } catch {
    return null;
  }
}
