import { test, expect, doWorkout, nav } from './fixtures';

test.describe('Giorno bonus', () => {
  test('compare con le serie saltate in settimana e le salva come recupero', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Usa senza account' }).click();

    const days = page.getByRole('radiogroup', { name: 'Giorno' });
    await expect(days.getByRole('radio', { name: 'Bonus' })).toHaveCount(0);

    // primo giorno fatto a metà: una sola serie
    await doWorkout(page, 1);
    await days.getByRole('radio', { name: 'Bonus' }).click();
    await expect(page.getByText(/Recupero della settimana: \d+ esercizi? saltat/)).toBeVisible();

    await page.screenshot({ path: 'e2e-results/bonus.png' });
    await page.getByRole('button', { name: 'Completa serie 1' }).click();
    await page.getByRole('button', { name: 'Concludi' }).click();
    await expect(page.getByRole('dialog', { name: 'Concludi allenamento' })).toContainText('Bonus');
    await page.getByRole('button', { name: 'Salva allenamento' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Allenamento salvato: 1 serie' }).last()).toBeVisible();

    await nav(page, 'Progressi');
    await expect(page.getByText(/· Bonus/)).toBeVisible();
  });
});
