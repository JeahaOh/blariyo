export interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: { onReady: () => void; onError: (event: { data: number }) => void };
    }
  ) => { destroy: () => void };
}
export interface InstagramApi {
  Embeds: { process: () => void };
}
function isYouTube(value: unknown): value is YouTubeApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'Player' in value &&
    typeof value.Player === 'function'
  );
}
function youtube(): YouTubeApi | null {
  const value: unknown = Reflect.get(window, 'YT');
  return isYouTube(value) ? value : null;
}
function isInstagram(value: unknown): value is InstagramApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'Embeds' in value &&
    typeof value.Embeds === 'object' &&
    value.Embeds !== null &&
    'process' in value.Embeds &&
    typeof value.Embeds.process === 'function'
  );
}
function instagram(): InstagramApi | null {
  const value: unknown = Reflect.get(window, 'instgrm');
  return isInstagram(value) ? value : null;
}
function loader<T>(source: string, read: () => T | null): () => Promise<T | null> {
  let pending: Promise<T | null> | undefined;
  return () => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    const existing = read();
    if (existing) return Promise.resolve(existing);
    if (pending) return pending;
    pending = new Promise<T | null>((resolve) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.referrerPolicy = 'strict-origin-when-cross-origin';
      let settled = false;
      const finish = (value: T | null) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        script.onerror = null;
        if (!value) {
          script.remove();
          pending = undefined;
        }
        resolve(value);
      };
      // YouTube's first script loads another script before exposing Player.
      const poll = setInterval(() => {
        const api = read();
        if (api) finish(api);
      }, 100);
      const timeout = setTimeout(() => finish(null), 12000);
      script.onerror = () => finish(null);
      document.head.append(script);
    });
    return pending;
  };
}
export const loadYouTube = loader('https://www.youtube.com/iframe_api', youtube);
export const loadInstagram = loader('https://www.instagram.com/embed.js', instagram);
