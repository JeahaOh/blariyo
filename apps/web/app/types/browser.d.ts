export {};
declare global {
  interface Window {
    gtag?: ((...args: unknown[]) => void) | undefined;
    dataLayer?: import('../utils/consent.mjs').AnalyticsDataLayerEntry[] | undefined;
    [key: `ga-disable-${string}`]: boolean;
    Kakao?: unknown;
  }
}
