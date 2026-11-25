import { Capacitor } from '@capacitor/core';
import { t } from './i18n';

/**
 * Salva un file di testo. Nel browser lo scarica; nell'app Android il download dalla pagina non funziona:
 * il file va nella cache dell'app e si apre la condivisione di Android (Drive, File, email…).
 */
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): Promise<void> {
  if (isNative()) return shareNative(filename, content);
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve();
}

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function shareNative(filename: string, content: string) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, files: [uri], dialogTitle: t('Salva o invia il file') });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(msg)) return;
    window.alert(`Non riesco a salvare il file: ${msg}`);
  }
}
