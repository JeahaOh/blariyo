import { fileURLToPath } from 'node:url';

const strictCompilerOptions = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  checkJs: true,
};

export default defineNuxtConfig({
  compatibilityDate: '2026-09-07',
  devtools: { enabled: false },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
  css: ['~/assets/css/main.css', '~/assets/css/admin.css'],
  typescript: {
    tsConfig: { compilerOptions: strictCompilerOptions },
    nodeTsConfig: { compilerOptions: strictCompilerOptions },
    sharedTsConfig: { compilerOptions: strictCompilerOptions },
  },
  nitro: { typescript: { tsConfig: { compilerOptions: strictCompilerOptions } } },
  hooks: {
    'nitro:config'(config) {
      // Keep Nuxt's HTML renderer first; handle remaining JSON errors before Nitro's fallback.
      const existing = config.errorHandler;
      config.errorHandler = [
        ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
        fileURLToPath(new URL('./server/error-handler.ts', import.meta.url)),
      ];
    },
  },
  runtimeConfig: {
    collectDirectInputEnabled: false,
    collectBatchReviewEnabled: false,
    discordReviewEnabled: false,
    collectManualUrlEnabled: false,
    collectDiscordCommandEnabled: false,
    coreOrigin: 'http://127.0.0.1:3100',
    trustedClientIpHeader: '',
    adminAuthMode: 'access',
    localAdminToken: '',
    localAdminLoginEnabled: false,
    localAdminRole: 'OWNER',
    serviceToken: '',
    actorSecret: '',
    accessIssuer: '',
    accessAudience: '',
    adminOperatorsFile: '',
    public: {
      siteOrigin: 'http://localhost:3000',
      siteName: '블라리요',
      homeTagline: '블라블라블라',
      homeTitle: '블라리요 - 블라블라블라',
      homeDescription: '블라리요에서 블라블라블라',
      homeOgDescription: '블라리요에서 블라블라블라',
      footerTagline: '블라블라블라',
      ga4Enabled: false,
      analyticsApproved: false,
      ga4MeasurementId: '',
      analyticsConnectOrigins: '',
      imageOrigin: '',
      xEmbedsEnabled: false,
      socialEmbedsEnabled: false,
      rightsEmail: '',
      contactEmail: '',
      privacyEmail: '',
      privacyOfficer: '',
      operatorDisplayName: '',
      kakaoEnabled: false,
      kakaoKey: '',
      kakaoSdkUrl: '',
      kakaoIntegrity: '',
      kakaoConnectOrigins: '',
    },
  },
});
