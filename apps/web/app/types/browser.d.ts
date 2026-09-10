export {};
declare global {
  interface Window {
    gtag?: ((...args: unknown[]) => void) | undefined;
    dataLayer?: IArguments[] | undefined;
    [key: `ga-disable-${string}`]: boolean;
    Kakao?: unknown;
  }
}
