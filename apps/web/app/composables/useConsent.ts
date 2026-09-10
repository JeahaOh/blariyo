import { readConsent, saveConsent } from '~/utils/consent.mjs';
export function useConsent() {
  const config = useRuntimeConfig().public;
  const enabled = computed(() => config.ga4Enabled === true && config.analyticsApproved === true);
  const consent = useState<ReturnType<typeof readConsent>>('analytics-consent', () => null),
    storageError = useState('consent-error', () => ''),
    ready = useState('consent-ready', () => false);
  function refresh() {
    try {
      consent.value = readConsent(localStorage, enabled.value);
    } catch {
      consent.value = null;
    }
    ready.value = true;
  }
  function save(value: boolean) {
    try {
      consent.value = saveConsent(localStorage, value, enabled.value);
      storageError.value = '';
      window.dispatchEvent(new Event('blariyo-consent-change'));
      return true;
    } catch {
      consent.value = null;
      storageError.value = '선택을 저장할 수 없습니다. 분석 기능을 사용하지 않습니다.';
      window.dispatchEvent(
        new CustomEvent('blariyo-consent-change', { detail: { storageFailed: true } })
      );
      return false;
    }
  }
  return { enabled, consent, storageError, ready, refresh, save };
}
