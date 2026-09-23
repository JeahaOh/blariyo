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
  css: ['~/assets/css/main.css'],
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
    collectBatchReviewEnabled: false,
    collectManualUrlEnabled: false,
    collectDiscordCommandEnabled: false,
    coreOrigin: 'http://127.0.0.1:3100',
    trustedClientIpHeader: '',
    adminAuthMode: 'access',
    localAdminToken: '',
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
