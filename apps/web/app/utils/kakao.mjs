/**
 * @typedef {object} KakaoSdk
 * @property {() => boolean} isInitialized
 * @property {(key: string) => void} init
 * @property {{sendDefault(options: {objectType: string, content: {title: string, description: string, imageUrl: string, link: {mobileWebUrl: string, webUrl: string}}}): void}} Share
 */
/** @param {unknown} value @returns {value is KakaoSdk} */
function isKakao(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isInitialized' in value &&
    typeof value.isInitialized === 'function' &&
    'init' in value &&
    typeof value.init === 'function' &&
    'Share' in value &&
    typeof value.Share === 'object' &&
    value.Share !== null &&
    'sendDefault' in value.Share &&
    typeof value.Share.sendDefault === 'function'
  );
}
/**
 * @param {{kakaoEnabled: boolean, kakaoKey: string, kakaoIntegrity: string, kakaoSdkUrl: string}} config
 * @param {{Kakao?: unknown}} win
 * @param {Document} doc
 * @returns {Promise<KakaoSdk | null>}
 */
export function loadKakao(config, win, doc) {
  if (
    !config.kakaoEnabled ||
    !config.kakaoKey ||
    !config.kakaoIntegrity ||
    !/^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/[0-9.]+\/kakao\.min\.js$/.test(config.kakaoSdkUrl)
  )
    return Promise.resolve(null);
  return new Promise((resolve) => {
    const script = doc.createElement('script');
    script.src = config.kakaoSdkUrl;
    script.integrity = config.kakaoIntegrity;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      try {
        if (!isKakao(win.Kakao)) return resolve(null);
        if (!win.Kakao.isInitialized()) win.Kakao.init(config.kakaoKey);
        resolve(win.Kakao);
      } catch {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    doc.head.appendChild(script);
  });
}
