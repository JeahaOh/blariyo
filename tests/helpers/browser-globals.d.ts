export {};
declare global {
  interface Window {
    dataLayer?: import('../../apps/web/app/utils/consent.mjs').AnalyticsDataLayerEntry[];
    [key: `ga-disable-${string}`]: boolean;
  }
}
