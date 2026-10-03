import { analyticsRuntime } from '~/utils/consent.mjs';
export default defineNuxtPlugin((nuxt) => {
  const config = useRuntimeConfig().public,
    route = useRoute(),
    consent = useConsent();
  const pageView = () =>
    runtime.pageView(route.fullPath, route.path, {
      list_page: /^\/[^/]+$/.test(route.path) ? Number(route.query.page || 1) : undefined,
    });
  consent.refresh();
  const runtime = analyticsRuntime<HTMLScriptElement>({
    window,
    document,
    storage: { getItem: (key: string) => window.localStorage.getItem(key) },
    enabled: config.ga4Enabled === true && config.analyticsApproved === true,
    measurementId: config.ga4MeasurementId,
    origin: config.siteOrigin,
    getPath: () => route.path,
    onCookieFailure: consent.setCookieFailure,
    onConsentInvalid: consent.setReadFailure,
  });
  window.addEventListener('blariyo-consent-change', () => {
    runtime.setStorageFailed(consent.storageFailed.value);
    pageView();
  });
  window.addEventListener('blariyo-consent-retry', () => {
    runtime.stop();
    runtime.setStorageFailed(consent.storageFailed.value);
    pageView();
  });
  window.addEventListener('storage', () => {
    consent.refresh();
    runtime.setStorageFailed(consent.storageFailed.value);
    pageView();
  });
  nuxt.hook('page:finish', () => {
    runtime.sync();
    pageView();
  });
  runtime.setStorageFailed(consent.storageFailed.value);
  return { provide: { analytics: runtime } };
});
