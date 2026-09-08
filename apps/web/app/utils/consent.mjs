export function readConsent(storage, enabled, now = new Date()) {
  if (!enabled) return null;
  try {
    const value = JSON.parse(storage.getItem('blariyo_consent'));
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
    return value;
  } catch {
    return null;
  }
}
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
const allowed = {
  page_view: ['page_type', 'route_template'],
  select_content: ['board_slug', 'content_type', 'list_position_bucket'],
  share: ['share_method', 'board_slug'],
  scroll: ['page_type', 'scroll_depth_bucket'],
};
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
    pendingPageView = null,
    lastPageViewKey = null;
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
    win['ga-disable-' + measurementId] = true;
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
        if (/^_ga(?:_|$)/.test(name))
          for (const domain of domains)
            doc.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ' Domain=' + domain + ';' : ''}`;
      }
    } catch {
      /* Transmission stays disabled even when browser cookie access fails. */
    }
  }
  function send(event, values = {}, path = getPath()) {
    if (!loaded || !permitted() || !allowed[event]) return;
    const fields = analyticsFields(path, origin),
      params = {
        page_title: fields.page_title,
        page_location: fields.page_location,
        page_referrer: '',
      };
    const vocabulary = {
      page_type: ['list', 'detail', 'policy', 'other'],
      route_template: ['/:boardSlug', '/:boardSlug/posts/:postId', '/policy', '/other'],
      board_slug: ['meme'],
      content_type: ['post'],
      list_position_bucket: ['1-5', '6-10', '11-15', '16-20', 'pinned'],
      share_method: ['copy', 'native', 'kakao', 'x'],
      scroll_depth_bucket: ['25', '50', '75', '100'],
    };
    for (const key of allowed[event]) {
      const value = values[key] ?? fields[key];
      if (vocabulary[key]?.includes(value)) params[key] = value;
    }
    win.gtag?.('event', event, params);
  }
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
    win['ga-disable-' + measurementId] = false;
    win.dataLayer = [];
    win.gtag = function () {
      win.dataLayer.push(arguments);
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
    setStorageFailed(value) {
      storageFailed = value;
      sync();
    },
  };
}
