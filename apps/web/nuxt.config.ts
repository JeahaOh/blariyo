export default defineNuxtConfig({
  compatibilityDate: '2026-08-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  runtimeConfig: {
    coreApiBaseUrl: 'http://api:4000',
    coreApiTimeoutMs: 3000,
    trustedClientIpHeader: '',
    coreServiceToken: '',
    adminActorHmacSecret: '',
    adminIdentityProvider: 'cloudflare-access',
    adminOperatorId: '',
    cloudflareAccessAudience: '',
    cloudflareAccessTeamDomain: '',
    public: {
      siteBaseUrl: 'https://__SERVICE_DOMAIN__',
    },
  },
  routeRules: {
    '/': { redirect: '/meme' },
  },
  typescript: {
    strict: true,
  },
})
