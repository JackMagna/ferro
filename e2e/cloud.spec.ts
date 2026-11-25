import { test, expect, nav, doWorkout, expectToast, openMeasures } from './fixtures';
import { MARIO, getDoc, listDocs, loginWithGoogle, uidOf } from './emulator';

test.describe('Dati nel cloud (Firestore)', () => {
  test('un allenamento salvato arriva in Firestore e si ritrova su un altro dispositivo', async ({ page, browser }) => {
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await doWorkout(page, 2);
    const uid = await uidOf(MARIO);

    await expect.poll(async () => (await listDocs(`users/${uid}/sessions`)).length).toBe(1);
    const [session] = await listDocs(`users/${uid}/sessions`);
    expect(session.data.userId).toBe(uid);
    expect((session.data.sets as unknown[]).length).toBe(2);

    // secondo dispositivo: stesso account, browser pulito
    const other = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const phone = await other.newPage();
    await phone.goto('./');
    await loginWithGoogle(phone, MARIO);
    await nav(phone, 'Progressi');
    await expect(phone.getByText('Nessun allenamento salvato')).toHaveCount(0);
    await other.close();
  });

  test('una misura chiede il consenso sanitario e poi viene salvata con il consenso', async ({ page }) => {
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await openMeasures(page);
    await page.getByRole('button', { name: 'Nuova misura' }).click();
    await page.locator('#m-weightKg').fill('82,5');
    await page.getByRole('button', { name: 'Salva misura' }).click();

    const consent = page.getByRole('dialog', { name: 'I tuoi dati sulla salute' });
    await expect(consent).toBeVisible();
    await expect(consent.getByRole('button', { name: 'Acconsento' })).toBeDisabled();
    await consent.getByRole('checkbox').check();
    await consent.getByRole('button', { name: 'Acconsento' }).click();
    await expectToast(page, 'Misura salvata');

    const uid = await uidOf(MARIO);
    await expect.poll(async () => (await listDocs(`users/${uid}/measurements`)).map((m) => m.data.weightKg)).toEqual([82.5]);
    await expect.poll(async () => ((await getDoc(`users/${uid}`))?.consent as { health?: unknown } | undefined)?.health).toBeTruthy();
  });

  test('senza consenso la misura non viene salvata', async ({ page }) => {
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await openMeasures(page);
    await page.getByRole('button', { name: 'Nuova misura' }).click();
    await page.locator('#m-weightKg').fill('80');
    await page.getByRole('button', { name: 'Salva misura' }).click();
    await page.getByRole('dialog', { name: 'I tuoi dati sulla salute' }).getByRole('button', { name: 'Non ora' }).click();

    const uid = await uidOf(MARIO);
    await page.waitForTimeout(1500);
    expect(await listDocs(`users/${uid}/measurements`)).toEqual([]);
  });
});
