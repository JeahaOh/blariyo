/**
 * @typedef {{version: number, scope: string, analytics: boolean, ads: boolean, savedAt: string}} Consent
 * @typedef {{getItem(key: string): string | null}} ConsentReader
 * @typedef {{setItem(key: string, value: string): void}} ConsentWriter
 * @typedef {IArguments | Record<string, unknown>} AnalyticsDataLayerEntry
 * @typedef {{gtag?: ((...args: unknown[]) => void) | undefined, dataLayer?: AnalyticsDataLayerEntry[] | undefined, dispatchEvent?: ((event: Event) => boolean) | undefined, [key: `ga-disable-${string}`]: boolean}} AnalyticsWindow
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
      value?.version !== 3 ||
      value.scope !== 'analytics_v1' ||
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
      version: 3,
      scope: 'analytics_v1',
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
    version: 3,
    scope: 'analytics_v1',
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
  page_view: [
    'page_content_key',
    'list_page',
    'entry_source',
    'entry_campaign',
    'entry_share_method',
  ],
  list_impression: [
    'board_slug',
    'list_instance_key',
    'list_area',
    'list_kind',
    'list_page',
    'list_position',
    'content_key',
    'content_type',
    'impression_key',
  ],
  select_content: [
    'board_slug',
    'list_instance_key',
    'list_area',
    'list_kind',
    'list_page',
    'list_position',
    'content_key',
    'content_type',
    'exposure_state',
    'impression_key',
    'open_mode',
  ],
  list_page_change: ['list_area', 'from_list_page', 'to_list_page', 'list_instance_key'],
  scroll: ['page_content_key', 'depth_percent'],
  content_engagement: ['page_content_key', 'active_ms', 'flush_reason'],
  share_open: ['page_content_key', 'board_slug'],
  share: [
    'page_content_key',
    'board_slug',
    'share_method',
    'share_attempt_key',
    'parent_attempt_key',
  ],
  share_result: [
    'page_content_key',
    'board_slug',
    'share_method',
    'share_outcome',
    'share_attempt_key',
    'parent_attempt_key',
  ],
};
const analyticsKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16)
      );
/** @param {unknown} value */
const contentKey = (value) =>
  typeof value === 'string' && /^p1_[a-f0-9]{64}$/.test(value) ? value : undefined;
/** @param {unknown} value @param {number} min @param {number} max @returns {number | undefined} */
const integerIn = (value, min, max) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
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
    storageFailed = false,
    contextKey = analyticsKey(),
    viewKey = analyticsKey();
  /** @type {{key: string, path: string, values: Record<string, unknown>} | null} */
  let pendingPageView = null;
  /** @type {string | null} */
  let lastPageViewKey = null;
  /** @type {Set<object>} */
  const commands = new Set();
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
    contextKey = analyticsKey();
    viewKey = analyticsKey();
    win[`ga-disable-${measurementId}`] = true;
    doc.getElementById('blariyo-ga4')?.remove();
    win.gtag = undefined;
    // GTM owns the shared array and its push handler; remove only this adapter's commands.
    if (win.dataLayer)
      for (let i = win.dataLayer.length - 1; i >= 0; i--) {
        const entry = win.dataLayer[i];
        if (entry && commands.has(entry)) win.dataLayer.splice(i, 1);
      }
    commands.clear();
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
    if (!loaded || !permitted() || !selectedFields) return false;
    const fields = analyticsFields(path, origin);
    /** @type {Record<string, string | number | undefined>} */
    const params = {
      schema_version: 1,
      event_key: analyticsKey(),
      context_key: contextKey,
      view_key: viewKey,
      send_to: measurementId,
      page_title: fields.page_title,
      page_location: fields.page_location,
      page_referrer: '',
      page_type: fields.page_type === 'other' ? undefined : fields.page_type,
      route_template: fields.route_template,
    };
    /** @type {Record<string, string[]>} */
    const vocabulary = {
      page_type: ['list', 'detail', 'policy', 'other'],
      route_template: ['/:boardSlug', '/:boardSlug/posts/:postId', '/policy', '/other'],
      board_slug: ['meme'],
      list_area: ['main', 'detail_footer'],
      list_kind: ['regular', 'pinned'],
      content_type: ['post'],
      exposure_state: ['qualified', 'unqualified'],
      open_mode: ['same_tab', 'new_context', 'unknown'],
      share_method: ['copy', 'native', 'kakao', 'x'],
      share_outcome: [
        'copied',
        'browser_resolved',
        'cancelled',
        'failed',
        'unavailable',
        'handoff',
      ],
      flush_reason: ['interval', 'hidden', 'blur', 'navigation', 'pagehide'],
      entry_source: ['direct', 'share', 'search', 'internal', 'other'],
      entry_campaign: ['share_copy', 'share_native', 'share_kakao', 'share_x'],
      entry_share_method: ['copy', 'native', 'kakao', 'x'],
    };
    for (const key of selectedFields) {
      const value = values[key] ?? fields[key];
      if (key === 'page_content_key' || key === 'content_key') params[key] = contentKey(value);
      else if (key === 'list_instance_key' || key === 'impression_key')
        params[key] =
          typeof value === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
            ? value
            : undefined;
      else if (key === 'share_attempt_key' || key === 'parent_attempt_key')
        params[key] =
          typeof value === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
            ? value
            : undefined;
      else if (key === 'list_page' || key === 'from_list_page' || key === 'to_list_page')
        params[key] = integerIn(value, 1, 10000);
      else if (key === 'list_position') params[key] = integerIn(value, 1, 20);
      else if (key === 'depth_percent')
        params[key] = [25, 50, 75, 100].includes(Number(value)) ? Number(value) : undefined;
      else if (key === 'active_ms') params[key] = integerIn(value, 1, 60000);
      else if (typeof value === 'string' && vocabulary[key]?.includes(value)) params[key] = value;
    }
    for (const key of Object.keys(params)) if (params[key] === undefined) delete params[key];
    /** @type {Record<string, string[]>} */
    const required = {
      list_impression: [
        'content_key',
        'list_instance_key',
        'list_area',
        'list_kind',
        'list_page',
        'list_position',
        'impression_key',
      ],
      select_content: [
        'content_key',
        'list_instance_key',
        'list_area',
        'list_kind',
        'list_page',
        'list_position',
        'content_type',
        'exposure_state',
        'open_mode',
      ],
      list_page_change: ['list_area', 'from_list_page', 'to_list_page', 'list_instance_key'],
      scroll: ['page_content_key', 'depth_percent'],
      content_engagement: ['page_content_key', 'active_ms', 'flush_reason'],
      share_open: ['page_content_key', 'board_slug'],
      share: ['page_content_key', 'board_slug', 'share_method', 'share_attempt_key'],
      share_result: [
        'page_content_key',
        'board_slug',
        'share_method',
        'share_outcome',
        'share_attempt_key',
      ],
    };
    if (required[event]?.some((key) => params[key] === undefined)) return false;
    if (
      event === 'select_content' &&
      ((params.exposure_state === 'qualified' && !params.impression_key) ||
        (params.exposure_state === 'unqualified' && params.impression_key))
    )
      return false;
    if (event === 'share_result') {
      /** @type {Record<string, string[]>} */
      const resultMatrix = {
        copy: ['copied', 'failed', 'unavailable'],
        native: ['browser_resolved', 'cancelled', 'failed', 'unavailable'],
        kakao: ['handoff', 'failed', 'unavailable'],
        x: ['handoff', 'failed', 'unavailable'],
      };
      if (
        typeof params.share_method !== 'string' ||
        typeof params.share_outcome !== 'string' ||
        !resultMatrix[params.share_method]?.includes(params.share_outcome)
      )
        return false;
    }
    if (
      params.parent_attempt_key &&
      (event === 'share' || event === 'share_result') &&
      params.share_method !== 'copy'
    )
      return false;
    if (Object.keys(params).length > 25 || typeof win.gtag !== 'function') return false;
    win.gtag('event', event, params);
    return true;
  }
  /** @param {string | number} navigationKey @param {string} [path] @param {Record<string, unknown>} [values] */
  function pageView(navigationKey, path = getPath(), values = {}) {
    if (!permitted()) return;
    const key = String(navigationKey);
    if (lastPageViewKey === key || pendingPageView?.key === key) return;
    viewKey = analyticsKey();
    if (!loaded) {
      pendingPageView = { key, path, values };
      return;
    }
    lastPageViewKey = key;
    send('page_view', values, path);
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
    win.dataLayer ??= [];
    win.gtag = function () {
      commands.add(arguments);
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
      if (typeof win.dispatchEvent === 'function')
        win.dispatchEvent(new Event('blariyo-analytics-ready'));
      if (pendingPageView) {
        lastPageViewKey = pendingPageView.key;
        send('page_view', pendingPageView.values, pendingPageView.path);
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
    isReady: () => loaded && permitted(),
    captureView: () => {
      if (!loaded || !permitted()) return null;
      const capturedContextKey = contextKey;
      const capturedViewKey = viewKey;
      return {
        isCurrent: () =>
          loaded && permitted() && contextKey === capturedContextKey && viewKey === capturedViewKey,
      };
    },
    pageView,
    /** @param {boolean} value */
    setStorageFailed(value) {
      storageFailed = value;
      sync();
    },
  };
}
