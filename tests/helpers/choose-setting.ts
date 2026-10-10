import assert from 'node:assert/strict';
import type { Page, Locator } from '@playwright/test';

export async function chooseSetting(page: Page, control: Locator, label: string) {
  const name = await control.getAttribute('aria-label');
  assert.ok(name);
  await control.click();
  await page
    .getByRole('listbox', { name, exact: true })
    .getByRole('option', { name: label, exact: true })
    .click();
}
