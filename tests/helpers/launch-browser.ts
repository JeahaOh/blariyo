import { chromium } from '@playwright/test';
export async function launchBrowser() {
  const endpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
  if (endpoint) {
    const target = new URL(endpoint);
    if (target.protocol !== 'ws:' || target.hostname !== '127.0.0.1' || target.port !== '55450')
      throw new Error('Use the owned loopback Playwright server on 55450');
  }
  const browser = endpoint
    ? await chromium.connect(endpoint, { exposeNetwork: '<loopback>', timeout: 30000 })
    : await chromium.launch({ headless: true });
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    // Individual tests can install narrower synthetic responses after this fallback.
    // Ordinary browser regressions must never contact real analytics or source providers.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return route.continue();
      if (url.href === 'https://www.googletagmanager.com/gtm.js?id=GTM-5BRTQ5T3')
        return route.fulfill({ contentType: 'application/javascript', body: '' });
      return route.abort('blockedbyclient');
    });
    return context;
  };
  return browser;
}
