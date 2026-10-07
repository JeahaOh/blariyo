export default defineNuxtPlugin((nuxt) => {
  const { begin, reset } = useUiLoadingState();
  let finish: (() => void) | undefined;
  const end = () => {
    finish?.();
    finish = undefined;
  };
  nuxt.hook('page:loading:start', () => {
    finish ??= begin();
  });
  nuxt.hook('page:loading:end', end);
  nuxt.hook('vue:error', end);
  nuxt.hook('app:error', () => {
    end();
    reset();
  });
  const router = useRouter();
  router.afterEach((_to, _from, failure) => {
    if (failure) end();
  });
  router.onError(end);
});
