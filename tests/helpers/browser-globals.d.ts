export {};
declare global {
  interface Window {
    dataLayer?: IArguments[];
    [key: `ga-disable-${string}`]: boolean;
  }
}
