import assert from 'node:assert/strict';
import type { AnalyticsWindow, AnalyticsScript } from '../../apps/web/app/utils/consent.mjs';
export type { AnalyticsWindow, AnalyticsScript };
export function fire(
  scripts: AnalyticsScript[],
  index: number,
  kind: 'onload' | 'onerror' = 'onload'
) {
  const script = scripts[index];
  assert.ok(script);
  const callback = script[kind];
  assert.ok(callback);
  callback(new Event(kind === 'onload' ? 'load' : 'error'));
}
export function events(win: AnalyticsWindow): unknown[][] {
  assert.ok(win.dataLayer);
  return win.dataLayer
    .filter((entry): entry is IArguments => Symbol.iterator in entry)
    .map((args): unknown[] => Array.from(args));
}
