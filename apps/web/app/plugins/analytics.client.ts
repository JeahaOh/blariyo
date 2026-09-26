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
  });
  window.addEventListener('blariyo-consent-change', (event: Event) => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
    runtime.setStorageFailed(
      typeof detail === 'object' &&
        detail !== null &&
        'storageFailed' in detail &&
        detail.storageFailed === true
    );
    pageView();
  });
  window.addEventListener('storage', () => {
    consent.refresh();
    runtime.sync();
    pageView();
  });
  nuxt.hook('page:finish', () => {
    runtime.sync();
    pageView();
  });
  runtime.sync();
  return { provide: { analytics: runtime } };
});
