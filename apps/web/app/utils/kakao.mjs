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
