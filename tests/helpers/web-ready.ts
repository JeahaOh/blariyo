import type { Page } from '@playwright/test';

/** SSR markup can appear before Vue attaches input handlers. Use the same readiness signal as core browser tests. */
export async function waitForWebReady(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt');
    return root !== null && '__vue_app__' in root && !!root.__vue_app__;
  });
}
