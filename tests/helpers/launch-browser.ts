import { chromium } from '@playwright/test';
export function launchBrowser() {
  const endpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
  if (!endpoint) return chromium.launch({ headless: true });
  const target = new URL(endpoint);
  if (target.protocol !== 'ws:' || target.hostname !== '127.0.0.1' || target.port !== '55450')
    throw new Error('Use the owned loopback Playwright server on 55450');
  return chromium.connect(endpoint, { exposeNetwork: '<loopback>', timeout: 30000 });
}
