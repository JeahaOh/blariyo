import { randomBytes } from 'node:crypto';
import { env } from 'node:process';
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
    const scripts = ["'self'", `'nonce-${nonce}'`],
      connect = ["'self'"];
    if (env.NODE_ENV !== 'production') connect.push('ws:');
    if (config.ga4Enabled && config.analyticsApproved) {
      scripts.push('https://www.googletagmanager.com');
      connect.push(...origins(config.analyticsConnectOrigins));
    }
    if (config.kakaoEnabled && config.kakaoKey && config.kakaoIntegrity) {
      try {
        scripts.push(new URL(config.kakaoSdkUrl).origin);
      } catch {}
      connect.push(...origins(config.kakaoConnectOrigins));
    }
    const image = origins(config.imageOrigin);
    setHeader(
      event,
      'Content-Security-Policy',
      `default-src 'self'; img-src 'self' ${image.join(' ')} data:; script-src ${scripts.join(' ')}; style-src 'self' 'unsafe-inline'; connect-src ${connect.join(' ')}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
    );
    setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (env.NODE_ENV === 'production')
      setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });
  nitro.hooks.hook('render:html', (html, { event }) => {
    for (const key of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const)
      html[key] = html[key].map((value) =>
        value.replace(/<script\b/g, `<script nonce="${event.context.cspNonce}"`)
      );
  });
});
