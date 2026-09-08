import { analyticsRuntime } from '~/utils/consent.mjs';
export default defineNuxtPlugin((nuxt) => {
  const config = useRuntimeConfig().public,
    route = useRoute(),
    consent = useConsent();
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
  window.addEventListener('blariyo-consent-change', (event: any) =>
    runtime.setStorageFailed(event.detail?.storageFailed === true)
  );
  window.addEventListener('storage', () => {
    consent.refresh();
    runtime.sync();
  });
  nuxt.hook('page:finish', () => {
    runtime.sync();
    runtime.send('page_view');
  });
  runtime.sync();
  return { provide: { analytics: runtime } };
});
