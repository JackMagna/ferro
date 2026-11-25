import { test, expect, nav, openAccount, doWorkout, expectToast } from './fixtures';
import { LUCIA, MARIO, authUsers, loginWithGoogle } from './emulator';

test.describe('Accesso con Google', () => {
  test('dalla schermata iniziale si entra, si resta dentro ricaricando e si esce', async ({ page, pageErrors }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Ferro' })).toBeVisible();
    await loginWithGoogle(page, MARIO);
    await expectToast(page, 'Ciao Mario');
    expect((await authUsers()).map((u) => u.email)).toEqual([MARIO.email]);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toContainText('Mario');

    const account = await openAccount(page);
    await expect(account).toContainText('Connesso come Mario Prova');
    await expect(account).toContainText(MARIO.email);
    await account.getByRole('button', { name: 'Esci' }).click();
    await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('con la rete lenta all\'avvio resta dentro e non mostra la schermata di accesso', async ({ page, pageErrors }) => {
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await expectToast(page, 'Ciao Mario');

    // all'avvio Firebase ricontrolla l'account in rete (accounts:lookup): qui risponde dopo 9 secondi
    let delayed = 0;
    await page.route(/accounts:lookup/, async (route) => {
      delayed++;
      await new Promise((r) => setTimeout(r, 9000));
      await route.continue().catch(() => undefined);
    });
    await page.reload();
    const welcome = page.getByRole('button', { name: 'Usa senza account' });
    for (let i = 0; i < 20; i++) {
      await expect(welcome).toHaveCount(0);
      await page.waitForTimeout(500);
    }
    await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toContainText('Mario', { timeout: 15_000 });
    expect(delayed, "il controllo in rete dell'account deve essere stato rallentato").toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('ogni account vede solo i propri allenamenti', async ({ page }) => {
    await page.goto('./');
    await loginWithGoogle(page, MARIO);
    await doWorkout(page, 2);
    await nav(page, 'Progressi');
    await expect(page.getByText('Nessun allenamento salvato')).toHaveCount(0);

    const account = await openAccount(page);
    await account.getByRole('button', { name: 'Esci' }).click();
    await loginWithGoogle(page, LUCIA);
    await nav(page, 'Progressi');
    await expect(page.getByText('Nessun allenamento salvato')).toBeVisible();
  });

  test('senza account si usa l\'app e si può accedere dopo', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Usa senza account' }).click();
    await expect(page.getByRole('button', { name: 'Account e impostazioni' })).toContainText('Senza account');
    const account = await openAccount(page);
    await loginWithGoogle(page, MARIO, account.getByRole('button', { name: 'Accedi con Google' }));
  });
});
