import { test, expect } from '@playwright/test';
test('team can create inventory, receive supplies, and receive an order', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email address').fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByText('Nitrile gloves', { exact: true })).toBeVisible();
  await expect(page.getByText('Refreshing workspace…')).not.toBeVisible();
  await page.screenshot({ path: '.local/screenshots/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Item name').fill('Outreach wellness pack');
  await page.getByLabel('SKU', { exact: true }).fill('E2E-001');
  await page.getByLabel('Category', { exact: true }).fill('Outreach');
  await page.getByLabel('Unit', { exact: true }).fill('pack');
  await page.getByLabel('Unit cost (USD)').fill('9.50');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Stock movements', exact: true }).click();
  await page.getByRole('button', { name: 'Record movement', exact: true }).click();
  await page
    .getByLabel('Item', { exact: true })
    .selectOption({ label: 'Outreach wellness pack · E2E-001' });
  await page.getByLabel('Location', { exact: true }).selectOption({ label: 'Main clinic' });
  await page.getByLabel('Quantity', { exact: true }).fill('25');
  await page.getByLabel('Reason / reference').fill('Initial outreach supplies');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('cell', { name: '+25', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Purchase orders', exact: true }).click();
  await page.getByRole('button', { name: 'New purchase order' }).click();
  await page
    .getByLabel('Supplier', { exact: true })
    .selectOption({ label: 'Example Supply Company' });
  await page.getByLabel('Deliver to').selectOption({ label: 'Main clinic' });
  await page
    .getByLabel('Item', { exact: true })
    .selectOption({ label: 'Outreach wellness pack · E2E-001' });
  await page.getByLabel('Line 1 quantity').fill('5');
  await page.getByRole('button', { name: 'Create draft order' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Mark ordered' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Receive all', exact: true }).click();
  await expect(page.getByText('received', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Inventory\s*\d*$/ }).click();
  await page.getByLabel('Search items').fill('E2E-001');
  const row = page.getByRole('row').filter({ hasText: 'E2E-001' });
  await expect(row).toContainText('30 pack');
  await expect(row).toContainText('$9.50');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/dashboard-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
