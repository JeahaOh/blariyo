import { env } from 'node:process';
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  if (env.NODE_ENV !== 'production') return;
  if (config.adminAuthMode === 'local' || config.localAdminToken)
    throw new Error('LOCAL_AUTH_FORBIDDEN');
  for (const key of [
    'siteName',
    'homeTagline',
    'homeTitle',
    'homeDescription',
    'homeOgDescription',
    'footerTagline',
    'rightsEmail',
    'contactEmail',
    'privacyEmail',
    'privacyOfficer',
    'operatorDisplayName',
  ]) {
    const value = (config.public as any)[key];
    if (typeof value !== 'string' || !value.trim() || /미정|입력 필요|\.invalid\b/.test(value))
      throw new Error('PUBLIC_CONFIG_REQUIRED');
  }
  if (
    config.public.analyticsEnabled &&
    (!/^G-[A-Z0-9]+$/.test(config.public.measurementId) || !config.public.analyticsConnectOrigins)
  )
    throw new Error('ANALYTICS_CONFIG_REQUIRED');
  if (config.public.analyticsEnabled && !config.public.analyticsApproved)
    throw new Error('ANALYTICS_APPROVAL_REQUIRED');
});
