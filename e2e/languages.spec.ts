import { test, expect } from '@playwright/test';

test('official logo and English, French, Spanish switching persist across sign-in and reload', async ({
  page,
}) => {
  await page.goto('/');
  const logo = page.getByRole('img', { name: 'Goshen Ignite', exact: true });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/branding/goshenignite-logo.png');
  expect(
    await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 164),
  ).toBe(true);
  await page.getByLabel('Language', { exact: true }).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Heureux de vous revoir' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Langue', { exact: true })).toHaveValue('fr');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await expect(page.getByText('Actualisation de l’espace…')).not.toBeVisible();
  await expect(page.getByRole('img', { name: 'Goshen Ignite', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Goshenignite · Inventaire');
  await page.getByRole('button', { name: /^Inventaire\s*\d*$/ }).click();
  await expect(page.getByText('Nitrile gloves', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter un article', exact: true }).click();
  await expect(page.getByLabel('Nom de l’article', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByLabel('Langue', { exact: true }).selectOption('es');
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByText('Nitrile gloves', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Movimientos de existencias', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
  await page
    .getByLabel('Artículo', { exact: true })
    .selectOption({ label: 'Nitrile gloves · CLN-001' });
  await page.getByLabel('Tipo de movimiento', { exact: true }).selectOption('issue');
  await page.getByLabel('Ubicación', { exact: true }).selectOption({ label: 'Main clinic' });
  await page.getByLabel('Cantidad', { exact: true }).fill('1');
  await page.getByLabel('Motivo / referencia', { exact: true }).fill('Comprobación de idioma');
  const submitted = page.waitForRequest(
    (req) => req.url().endsWith('/api/movements') && req.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  expect((await submitted).postDataJSON().type).toBe('issue');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'Salida', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ubicaciones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ubicaciones', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Idioma', { exact: true }).selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Emplacements', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/french-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByLabel('Langue', { exact: true })).toHaveValue('fr');
  await page.getByLabel('Langue', { exact: true }).selectOption('es');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le damos la bienvenida' })).toBeVisible();
  await expect(page.getByLabel('Idioma', { exact: true })).toHaveValue('es');
  await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
});
