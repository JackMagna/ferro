import { _android as android, expect, type AndroidDevice, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TestUser } from '../e2e/emulator';

/** Telefono o emulatore Android per i test: installa l'APK di prova, apre l'app e ne prende la pagina web (WebView). */
export const PKG = 'it.irontrack.app.test';
const APK = 'android/app/build/outputs/apk/debug/app-debug.apk';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const ADB = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

export const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: 'utf8' });

export async function connectDevice(): Promise<AndroidDevice> {
  if (!existsSync(APK)) throw new Error('APK di prova mancante: lancia prima `node scripts/android-e2e-build.mjs`.');
  const [device] = await android.devices();
  if (!device) throw new Error('Nessun dispositivo Android: collega il telefono con il debug USB attivo, oppure avvia un emulatore.');
  // l'app sul telefono raggiunge gli emulatori Firebase del PC come se fossero sul telefono
  for (const port of [9099, 8080]) adb('-s', device.serial(), 'reverse', `tcp:${port}`, `tcp:${port}`);
  adb('-s', device.serial(), 'install', '-r', '-g', APK);
  return device;
}

/** Riapre l'app da zero (dati cancellati) e restituisce la pagina della WebView. */
export async function launchFresh(device: AndroidDevice): Promise<Page> {
  await device.shell(`pm clear ${PKG}`);
  // pm clear toglie anche i permessi: notifiche (Android 13+) e fotocamera si concedono in anticipo,
  // così il test non si ferma sulla richiesta del sistema
  for (const p of ['POST_NOTIFICATIONS', 'CAMERA']) await device.shell(`pm grant ${PKG} android.permission.${p}`).catch(() => undefined);
  await device.shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  const webview = await device.webView({ pkg: PKG });
  const page = await webview.page();
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/** Accesso Google nell'app: nella build di prova è un token finto per l'emulatore, l'utente lo sceglie il test. */
export async function loginAs(page: Page, user: TestUser) {
  await page.evaluate((u) => localStorage.setItem('irontrack:test-google-user', JSON.stringify(u)), user);
  await page.getByRole('button', { name: 'Accedi con Google' }).first().click();
  await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toContainText(user.name.split(' ')[0]);
}

/** Notifiche attive dell'app (testo grezzo di dumpsys). */
export const notifications = () => adb('shell', 'dumpsys', 'notification', '--noredact').split('NotificationRecord').filter((r) => r.includes(`pkg=${PKG}`));
