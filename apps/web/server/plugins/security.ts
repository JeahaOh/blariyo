import { randomBytes } from 'node:crypto';
import { env } from 'node:process';

const gtmOrigin = 'https://www.googletagmanager.com';
const gtmScript = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;var n=d.querySelector('[nonce]');
n&&j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'));f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5BRTQ5T3');</script>
<!-- End Google Tag Manager -->`;
const gtmNoscript = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5BRTQ5T3"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('request', (event) => {
    const config = useRuntimeConfig(event).public,
      nonce = randomBytes(18).toString('base64');
    if (!config.ga4Enabled || !config.analyticsApproved) config.ga4MeasurementId = '';
    event.context.cspNonce = nonce;
    const origins = (value: string) =>
      value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => /^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(v));
    const scripts = ["'self'", `'nonce-${nonce}'`, gtmOrigin],
      connect = ["'self'", gtmOrigin];
    if (env.NODE_ENV !== 'production') connect.push('ws:');
    if (config.ga4Enabled && config.analyticsApproved) {
      connect.push(...origins(config.analyticsConnectOrigins));
    }
    if (config.kakaoEnabled && config.kakaoKey && config.kakaoIntegrity) {
      try {
        scripts.push(new URL(config.kakaoSdkUrl).origin);
      } catch {}
      connect.push(...origins(config.kakaoConnectOrigins));
    }
    const image = [gtmOrigin, ...origins(config.imageOrigin)];
    const frames = ["'self'", gtmOrigin];
    if (config.xEmbedsEnabled === true) {
      scripts.push('https://platform.x.com', 'https://platform.twitter.com');
      frames.push(
        'https://platform.x.com',
        'https://platform.twitter.com',
        'https://syndication.twitter.com'
      );
      connect.push('https://syndication.twitter.com', 'https://cdn.syndication.twimg.com');
    }
    if (config.socialEmbedsEnabled === true) {
      scripts.push('https://www.youtube.com', 'https://www.instagram.com');
      frames.push('https://www.youtube.com', 'https://www.tiktok.com', 'https://www.instagram.com');
    }
    setHeader(
      event,
      'Content-Security-Policy',
      `default-src 'self'; img-src 'self' ${image.join(' ')} data:; script-src ${scripts.join(' ')}; style-src 'self' 'unsafe-inline'; connect-src ${connect.join(' ')}; frame-src ${frames.join(' ')}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
    );
    setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (env.NODE_ENV === 'production')
      setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });
  nitro.hooks.hook('render:html', (html, { event }) => {
    // Insert once per HTML document, before Nuxt's head and body content.
    html.head.unshift(gtmScript);
    html.bodyPrepend.unshift(gtmNoscript);
    for (const key of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const)
      html[key] = html[key].map((value) =>
        value.replace(/<script\b/g, `<script nonce="${event.context.cspNonce}"`)
      );
  });
});
