/**
 * @typedef {{version: number, scope: string, analytics: boolean, ads: boolean, savedAt: string}} Consent
 * @typedef {{getItem(key: string): string | null}} ConsentReader
 * @typedef {{setItem(key: string, value: string): void}} ConsentWriter
 * @typedef {{gtag?: ((...args: unknown[]) => void) | undefined, dataLayer?: IArguments[] | undefined, [key: `ga-disable-${string}`]: boolean}} AnalyticsWindow
 */
/** @param {ConsentReader} storage @param {boolean} enabled @param {Date} [now] @returns {Consent | null} */
export function readConsent(storage, enabled, now = new Date()) {
  if (!enabled) return null;
  try {
    /** @type {unknown} */
    const input = JSON.parse(storage.getItem('blariyo_consent') || 'null');
    const value =
      input && typeof input === 'object' ? Object.fromEntries(Object.entries(input)) : {};
    if (
      value?.version !== 2 ||
      value.scope !== 'analytics' ||
      typeof value.analytics !== 'boolean' ||
      value.ads !== false ||
      typeof value.savedAt !== 'string'
    )
      return null;
    const saved = new Date(value.savedAt),
      expiry = new Date(saved);
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    if (expiry.getUTCMonth() !== saved.getUTCMonth()) expiry.setUTCDate(0);
    if (!Number.isFinite(+saved) || saved > now || expiry <= now) return null;
    return {
      ...value,
      version: 2,
      scope: 'analytics',
      analytics: value.analytics,
      ads: false,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}
/** @param {ConsentWriter} storage @param {boolean} analytics @param {boolean} enabled @param {Date} [now] @returns {Consent | null} */
export function saveConsent(storage, analytics, enabled, now = new Date()) {
  if (!enabled) return null;
  const value = {
    version: 2,
    scope: 'analytics',
    analytics: !!analytics,
    ads: false,
    savedAt: now.toISOString(),
  };
  storage.setItem('blariyo_consent', JSON.stringify(value));
  return value;
}
/** @param {string} path @param {string} origin @returns {Record<string, string>} */
export function analyticsFields(path, origin) {
  const type = /^\/[^/]+\/posts\/[^/]+$/.test(path)
    ? 'detail'
    : /^\/(terms|privacy|cookie-settings)$/.test(path)
      ? 'policy'
      : /^\/[^/]+$/.test(path)
        ? 'list'
        : 'other';
  return {
    page_title: '블라리요',
    page_location: origin + '/analytics/' + type,
    page_referrer: '',
    page_type: type,
    route_template:
      type === 'detail'
        ? '/:boardSlug/posts/:postId'
        : type === 'list'
          ? '/:boardSlug'
          : type === 'policy'
            ? '/policy'
            : '/other',
  };
}
/** @type {Record<string, string[]>} */
const allowed = {
  page_view: ['page_type', 'route_template'],
  select_content: ['board_slug', 'content_type', 'list_position_bucket'],
  share: ['share_method', 'board_slug'],
  scroll: ['page_type', 'scroll_depth_bucket'],
};
/**
 * @typedef {{id?: string, async?: boolean, src?: string, onload?: ((event: Event) => unknown) | null, onerror?: ((event: string | Event) => unknown) | null, remove(): void}} AnalyticsScript
 */
/**
 * @template {AnalyticsScript} Script
 * @typedef {{cookie: string, location?: {hostname: string}, head: {appendChild(script: Script): unknown}, createElement(tag: 'script'): Script, getElementById(id: string): {remove(): void} | null}} AnalyticsDocument
 */
/**
 * @template {AnalyticsScript} Script
 * @param {{window: AnalyticsWindow, document: AnalyticsDocument<Script>, storage: ConsentReader, enabled: boolean, measurementId: string, origin: string, getPath: () => string}} options
 */
export function analyticsRuntime({
  window: win,
  document: doc,
  storage,
  enabled,
  measurementId,
  origin,
  getPath,
}) {
  let loading = false,
    loaded = false,
    generation = 0,
    storageFailed = false;
  /** @type {{key: string, path: string} | null} */
  let pendingPageView = null;
  /** @type {string | null} */
  let lastPageViewKey = null;
  const permitted = () =>
    enabled &&
    !storageFailed &&
    /^G-[A-Z0-9]+$/.test(measurementId) &&
    !getPath().startsWith('/admin') &&
    readConsent(storage, true)?.analytics === true;
  function stop() {
    generation++;
    pendingPageView = null;
    lastPageViewKey = null;
    win[`ga-disable-${measurementId}`] = true;
    doc.getElementById('blariyo-ga4')?.remove();
    win.gtag = undefined;
    win.dataLayer = [];
    loading = false;
    loaded = false;
    try {
      const host = doc.location?.hostname || '',
        parts = host.split('.');
      const domains = [
        '',
        ...parts.map((_, i) => parts.slice(i).join('.')).filter((v) => v.includes('.')),
      ];
      for (const cookie of doc.cookie.split(';')) {
        const name = cookie.trim().split('=')[0];
        if (name && /^_ga(?:_|$)/.test(name))
          for (const domain of domains)
            doc.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ' Domain=' + domain + ';' : ''}`;
      }
    } catch {
      /* Transmission stays disabled even when browser cookie access fails. */
    }
  }
  /** @param {string} event @param {Record<string, unknown>} [values] @param {string} [path] */
  function send(event, values = {}, path = getPath()) {
    const selectedFields = allowed[event];
    if (!loaded || !permitted() || !selectedFields) return;
    const fields = analyticsFields(path, origin);
    /** @type {Record<string, string | undefined>} */
    const params = {
      page_title: fields.page_title,
      page_location: fields.page_location,
      page_referrer: '',
    };
    /** @type {Record<string, string[]>} */
    const vocabulary = {
      page_type: ['list', 'detail', 'policy', 'other'],
      route_template: ['/:boardSlug', '/:boardSlug/posts/:postId', '/policy', '/other'],
      board_slug: ['meme'],
      content_type: ['post'],
      list_position_bucket: ['1-5', '6-10', '11-15', '16-20', 'pinned'],
      share_method: ['copy', 'native', 'kakao', 'x'],
      scroll_depth_bucket: ['25', '50', '75', '100'],
    };
    for (const key of selectedFields) {
      const value = values[key] ?? fields[key];
      if (typeof value === 'string' && vocabulary[key]?.includes(value)) params[key] = value;
    }
    win.gtag?.('event', event, params);
  }
  /** @param {string | number} navigationKey @param {string} [path] */
  function pageView(navigationKey, path = getPath()) {
    if (!permitted()) return;
    const key = String(navigationKey);
    if (lastPageViewKey === key || pendingPageView?.key === key) return;
    if (!loaded) {
      pendingPageView = { key, path };
      return;
    }
    lastPageViewKey = key;
    send('page_view', {}, path);
  }
  function sync() {
    if (!permitted()) {
      stop();
      return;
    }
    if (loading || loaded) return;
    loading = true;
    const current = ++generation;
    win[`ga-disable-${measurementId}`] = false;
    win.dataLayer = [];
    win.gtag = function () {
      win.dataLayer?.push(arguments);
    };
    const fields = analyticsFields(getPath(), origin);
    win.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    win.gtag('js', new Date());
    win.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_title: fields.page_title,
      page_location: fields.page_location,
      page_referrer: '',
    });
    const script = doc.createElement('script');
    script.id = 'blariyo-ga4';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    script.onload = () => {
      if (current !== generation) return;
      if (!permitted()) {
        stop();
        return;
      }
      loaded = true;
      loading = false;
      if (pendingPageView) {
        lastPageViewKey = pendingPageView.key;
        send('page_view', {}, pendingPageView.path);
        pendingPageView = null;
      }
    };
    script.onerror = () => {
      if (current !== generation) return;
      loading = false;
      stop();
    };
    doc.head.appendChild(script);
  }
  return {
    sync,
    stop,
    send,
    pageView,
    /** @param {boolean} value */
    setStorageFailed(value) {
      storageFailed = value;
      sync();
    },
  };
}
