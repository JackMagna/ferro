import { test, expect, type AndroidDevice } from '@playwright/test';
import { MARIO, LUCIA, authUsers, listDocs, resetEmulators, uidOf } from '../e2e/emulator';
import { PKG, adb, connectDevice, launchFresh, loginAs, notifications } from './device';

let device: AndroidDevice;

test.beforeAll(async () => {
  device = await connectDevice();
  // primo avvio dopo l'installazione (con l'emulatore appena acceso Android può ricreare l'activity): a vuoto
  await launchFresh(device);
  await new Promise((r) => setTimeout(r, 5000));
  await device.shell(`am force-stop ${PKG}`);
});
test.afterAll(async () => {
  await device?.shell(`am force-stop ${PKG}`);
  await device?.close();
});
test.beforeEach(async () => {
  await resetEmulators();
});

test.describe('App Android', () => {
  test('accesso con Google (nativo) e allenamento salvato nel cloud', async () => {
    const page = await launchFresh(device);
    await loginAs(page, MARIO);
    expect((await authUsers()).map((u) => u.email)).toEqual([MARIO.email]);

    await page.getByRole('button', { name: 'Completa serie 1' }).click();
    await page.getByRole('button', { name: 'Concludi' }).click();
    await page.getByRole('button', { name: 'Salva allenamento' }).click();
    const uid = await uidOf(MARIO);
    await expect.poll(async () => (await listDocs(`users/${uid}/sessions`)).length).toBe(1);
  });

  test('notifica dell\'allenamento in corso dopo la prima serie', async () => {
    const page = await launchFresh(device);
    await loginAs(page, LUCIA);
    await page.getByRole('button', { name: 'Completa serie 1' }).click();
    await expect.poll(() => notifications().length, { message: 'notifica di Ferro nella barra' }).toBeGreaterThan(0);
    expect(notifications().join('\n')).toMatch(/Chest press/i);
  });

  test('i widget sono registrati nel sistema', async () => {
    const dump = adb('shell', 'dumpsys', 'package', PKG);
    for (const w of ['WorkoutWidget', 'MealsWidget', 'QuoteWidget']) expect(dump).toContain(`.widgets.${w}`);
  });

  test('eliminazione dell\'account dall\'app: via account e dati dal cloud', async () => {
    const page = await launchFresh(device);
    page.on('dialog', (d) => void d.accept());
    await loginAs(page, MARIO);
    await page.getByRole('button', { name: 'Completa serie 1' }).click();
    await page.getByRole('button', { name: 'Concludi' }).click();
    await page.getByRole('button', { name: 'Salva allenamento' }).click();
    const uid = await uidOf(MARIO);
    await expect.poll(async () => (await listDocs(`users/${uid}/sessions`)).length).toBe(1);

    await page.getByRole('button', { name: 'Account e impostazioni' }).click();
    await page.getByRole('button', { name: 'Elimina account e dati' }).click();
    await expect.poll(async () => (await authUsers()).length, { message: 'account eliminato da Authentication' }).toBe(0);
    expect(await listDocs(`users/${uid}/sessions`)).toEqual([]);
    await expect(page.getByRole('button', { name: 'Accedi con Google' }).first()).toBeVisible();
  });

  test('permessi: solo quelli che Ferro usa (Health Connect, notifiche, sveglie, fotocamera)', async () => {
    const dump = adb('shell', 'dumpsys', 'package', PKG);
    const requested = dump.split('requested permissions:')[1]?.split(/install permissions:|runtime permissions:/)[0] ?? '';
    const health = [...requested.matchAll(/android\.permission\.health\.([A-Z0-9_]+)/g)].map((m) => m[1]).sort();
    expect(health).toEqual([
      'READ_ACTIVE_CALORIES_BURNED', 'READ_BODY_FAT', 'READ_DISTANCE', 'READ_EXERCISE', 'READ_HEALTH_DATA_HISTORY', 'READ_HEART_RATE', 'READ_WEIGHT',
      'WRITE_BODY_FAT', 'WRITE_DISTANCE', 'WRITE_EXERCISE', 'WRITE_HYDRATION', 'WRITE_NUTRITION', 'WRITE_WEIGHT'
    ]);
    for (const p of ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'CAMERA', 'BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT']) expect(requested).toContain(`android.permission.${p}`);
    // la posizione serve al Bluetooth solo fino ad Android 11: su Android 12+ non deve esserci
    expect(requested).not.toContain('android.permission.ACCESS_COARSE_LOCATION');
    for (const p of ['ACCESS_FINE_LOCATION', 'RECORD_AUDIO', 'READ_CONTACTS', 'com.google.android.gms.permission.AD_ID']) expect(requested).not.toContain(p);
  });

  test('Health Connect: la pagina dei motivi dei permessi si apre e mostra l\'informativa', async () => {
    adb('shell', 'am', 'start', '-a', 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE', '-n', `${PKG}/app.capgo.plugin.health.PermissionsRationaleActivity`);
    await expect.poll(() => adb('shell', 'dumpsys', 'activity', 'activities'), { message: 'activity dei motivi in primo piano' })
      .toMatch(/(mResumedActivity|topResumedActivity).*PermissionsRationaleActivity/);
    await device.shell(`am force-stop ${PKG}`);
  });

  test('fotocamera disponibile per il codice a barre dei pasti', async () => {
    const page = await launchFresh(device);
    await page.getByRole('button', { name: 'Usa senza account' }).click();
    const result = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const n = stream.getVideoTracks().length;
        stream.getTracks().forEach((t) => t.stop());
        return `ok:${n}`;
      } catch (e) {
        return `errore:${(e as Error).name}`;
      }
    });
    expect(result).toBe('ok:1');
  });

  test('fascia cardio: nell\'app il Bluetooth è disponibile (non più «browser non supportato»)', async () => {
    const page = await launchFresh(device);
    await page.getByRole('button', { name: 'Usa senza account' }).click();
    await page.getByRole('button', { name: 'Collega sensore cardio' }).click();
    await expect(page.getByRole('button', { name: 'Cerca sensore' })).toBeEnabled();
    await expect(page.getByText('non supporta il Bluetooth')).toHaveCount(0);
  });

  test('l\'app non va in crash all\'avvio (nessun errore JavaScript)', async () => {
    const page = await launchFresh(device);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.getByRole('button', { name: 'Usa senza account' }).click();
    for (const section of ['Scheda', 'Pasti', 'Esercizi', 'Progressi', 'Allenamento']) {
      await page.getByRole('navigation', { name: 'Sezioni' }).getByRole('button', { name: section }).click();
    }
    expect(errors).toEqual([]);
  });
});
