import { readConsent, saveConsent } from '~/utils/consent.mjs';
export function useConsent() {
  const config = useRuntimeConfig().public;
  const enabled = computed(() => config.ga4Enabled === true && config.analyticsApproved === true);
  const consent = useState<ReturnType<typeof readConsent>>('analytics-consent', () => null),
    readError = useState('consent-read-error', () => ''),
    saveError = useState('consent-save-error', () => ''),
    cookieError = useState('consent-cookie-error', () => ''),
    pendingChoice = useState<boolean | null>('consent-pending-choice', () => null),
    ready = useState('consent-ready', () => false);
  const storageError = computed(() => [saveError.value || readError.value, cookieError.value].filter(Boolean).join(' '));
  const storageFailed = computed(() => !!(readError.value || saveError.value));
  function setReadFailure() {
    consent.value = null;
    readError.value = '저장된 선택을 읽을 수 없습니다. 분석 기능을 사용하지 않습니다.';
  }
  function setCookieFailure(failed: boolean) {
    cookieError.value = failed ? '분석 쿠키를 삭제하지 못했습니다. 추가 전송은 중단했습니다. 다시 시도해 주세요.' : '';
  }
  function refresh() {
    readError.value = '';
    try {
      consent.value = enabled.value ? readConsent(localStorage, true, new Date(), setReadFailure) : null;
    } catch {
      setReadFailure();
    }
    ready.value = true;
  }
  function save(value: boolean) {
    try {
      consent.value = enabled.value ? saveConsent(localStorage, value, true) : null;
      pendingChoice.value = null;
      readError.value = '';
      saveError.value = '';
      window.dispatchEvent(new Event('blariyo-consent-change'));
      return !storageError.value;
    } catch {
      consent.value = null;
      pendingChoice.value = value;
      saveError.value = '선택을 저장할 수 없습니다. 분석 기능을 사용하지 않습니다.';
      window.dispatchEvent(
        new CustomEvent('blariyo-consent-change', { detail: { storageFailed: true } })
      );
      return false;
    }
  }
  function retry() {
    // Retry the failed choice, especially withdrawal, instead of restoring an older grant.
    if (pendingChoice.value !== null) save(pendingChoice.value);
    else refresh();
    window.dispatchEvent(new Event('blariyo-consent-retry'));
  }
  return { enabled, consent, storageError, storageFailed, ready, refresh, save, retry, setReadFailure, setCookieFailure };
}
