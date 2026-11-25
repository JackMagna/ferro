import { test, expect, openAccount, doWorkout } from './fixtures';
import { MARIO, authUsers, getDoc, listDocs, loginWithGoogle, uidOf } from './emulator';

test('eliminazione dell\'account: cancella dati nel cloud e utente', async ({ page }) => {
  await page.goto('./');
  await loginWithGoogle(page, MARIO);
  await doWorkout(page, 1);
  const uid = await uidOf(MARIO);
  await expect.poll(async () => (await listDocs(`users/${uid}/sessions`)).length).toBe(1);

  const account = await openAccount(page);
  // l'eliminazione chiede di confermare l'identità con Google: di nuovo la finestra dell'emulatore
  const popupPromise = page.waitForEvent('popup');
  await account.getByRole('button', { name: 'Elimina account e dati' }).click();
  const popup = await popupPromise;
  await popup.getByText(MARIO.email).click();

  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => (await authUsers()).length).toBe(0);
  expect(await getDoc(`users/${uid}`)).toBeNull();
  expect(await listDocs(`users/${uid}/sessions`)).toEqual([]);
});
