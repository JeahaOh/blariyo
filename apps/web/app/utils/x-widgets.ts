interface XApi {
  widgets: {
    createTweet(
      id: string,
      element: HTMLElement,
      options: {
        dnt: boolean;
        lang: string;
        theme: string;
        conversation: string;
        width: number;
      }
    ): Promise<HTMLElement | undefined>;
  };
}
function isXApi(value: unknown): value is XApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'widgets' in value &&
    typeof value.widgets === 'object' &&
    value.widgets !== null &&
    'createTweet' in value.widgets &&
    typeof value.widgets.createTweet === 'function'
  );
}
function api(): XApi | null {
  const value: unknown = Reflect.get(window, 'twttr');
  return isXApi(value) ? value : null;
}
let pending: Promise<XApi | null> | undefined;
export function loadXWidgets(): Promise<XApi | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = api();
  if (existing) return Promise.resolve(existing);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://platform.x.com/widgets.js';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    let settled = false;
    const finish = (value: XApi | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (!value) {
        script.remove();
        pending = undefined;
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 12000);
    script.onload = () => finish(api());
    script.onerror = () => finish(null);
    document.head.append(script);
  });
  return pending;
}
