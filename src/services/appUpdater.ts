import { Capacitor, registerPlugin } from '@capacitor/core';

/** Plugin nativo scritto in native/android (update/FerroUpdatePlugin.java), presente solo nell'app Android. */
export interface UpdaterStatus {
  /** false nel file per Google Play: lì gli aggiornamenti li fa solo il Play Store. */
  selfUpdating: boolean;
  /** l'utente ha consentito a Ferro di installare app («Installa app sconosciute»). */
  canInstall: boolean;
}
export interface DownloadProgress {
  status: 'running' | 'done' | 'failed';
  done: number;
  total: number;
}
interface FerroUpdatePlugin {
  status(): Promise<UpdaterStatus>;
  schedule(): Promise<UpdaterStatus>;
  openInstallSettings(): Promise<UpdaterStatus>;
  download(o: { url: string; title: string }): Promise<{ id: number }>;
  progress(o: { id: number }): Promise<DownloadProgress>;
  install(): Promise<void>;
}

const plugin = registerPlugin<FerroUpdatePlugin>('FerroUpdate');

export function updaterAvailable(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('FerroUpdate');
  } catch {
    return false;
  }
}

/** Stato del plugin; null fuori dall'app Android o se il plugin manca. */
export async function updaterStatus(): Promise<UpdaterStatus | null> {
  if (!updaterAvailable()) return null;
  return plugin.status().catch(() => null);
}

/** Programma il controllo giornaliero con notifica (nell'APK del sito; nel file per Play non fa niente). */
export async function scheduleUpdateCheck(): Promise<UpdaterStatus | null> {
  if (!updaterAvailable()) return null;
  return plugin.schedule().catch(() => null);
}

export async function openInstallSettings(): Promise<UpdaterStatus | null> {
  if (!updaterAvailable()) return null;
  return plugin.openInstallSettings().catch(() => null);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Scarica l'APK e apre il programma di installazione di Android.
 * `onProgress` riceve la frazione scaricata (0–1, o null se la dimensione non è nota).
 */
export async function downloadAndInstall(url: string, title: string, onProgress: (f: number | null) => void): Promise<void> {
  const { id } = await plugin.download({ url, title });
  for (;;) {
    await wait(500);
    const p = await plugin.progress({ id });
    if (p.status === 'failed') throw new Error('download');
    onProgress(p.total > 0 ? Math.min(1, p.done / p.total) : null);
    if (p.status === 'done') break;
  }
  await plugin.install();
}
