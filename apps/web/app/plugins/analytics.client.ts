import { analyticsRuntime } from '~/utils/consent.mjs';
export default defineNuxtPlugin((nuxt) => {
  const config = useRuntimeConfig().public,
    route = useRoute(),
    consent = useConsent();
  const pageView = () => runtime.pageView(route.fullPath, route.path);
  consent.refresh();
  const runtime = analyticsRuntime({
    window,
    document,
    storage: { getItem: (key: string) => window.localStorage.getItem(key) },
    enabled: config.ga4Enabled === true && config.analyticsApproved === true,
    measurementId: config.ga4MeasurementId,
    origin: config.siteOrigin,
    getPath: () => route.path,
  });
  window.addEventListener('blariyo-consent-change', (event: any) => {
    runtime.setStorageFailed(event.detail?.storageFailed === true);
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
