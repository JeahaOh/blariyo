<script setup lang="ts">
import {
  tiktokMessage,
  youtubeFailure,
  type SocialReference,
  type EmbedFailure,
} from '~/utils/social-posts';
import { loadInstagram, loadYouTube } from '~/utils/social-widgets';
const props = defineProps<{ reference: SocialReference }>();
const enabled = useRuntimeConfig().public.socialEmbedsEnabled === true;
const label = computed(
  () => ({ YOUTUBE: 'YouTube', TIKTOK: 'TikTok', INSTAGRAM: 'Instagram' })[props.reference.provider]
);
const root = ref<HTMLElement | null>(null),
  target = ref<HTMLElement | null>(null);
const state = ref<'idle' | 'loading' | 'embedded' | EmbedFailure>('idle');
let active = true,
  generation = 0,
  frame: HTMLIFrameElement | undefined;
let observer: IntersectionObserver | undefined, mutation: MutationObserver | undefined;
let timer: ReturnType<typeof setTimeout> | undefined, destroyPlayer: (() => void) | undefined;
let removeFrameListeners: (() => void) | undefined;
const failed = computed(() => ['failed', 'unavailable', 'restricted'].includes(state.value));
const message = computed(() => {
  if (state.value === 'unavailable')
    return '현재 원문을 볼 수 없습니다. 삭제되었거나 비공개로 전환됐을 수 있습니다.';
  if (state.value === 'restricted')
    return '이 영상은 외부 사이트에서 재생할 수 없습니다. 원문에서 확인해 주세요.';
  if (state.value === 'failed')
    return '게시물을 불러오지 못했습니다. 다시 시도하거나 원문에서 확인해 주세요.';
  if (state.value === 'loading') return '게시물 불러오는 중…';
  return enabled ? '' : '원문에서 게시물을 확인해 주세요.';
});
function cleanup() {
  if (timer) clearTimeout(timer);
  mutation?.disconnect();
  removeFrameListeners?.();
  removeFrameListeners = undefined;
  try {
    destroyPlayer?.();
  } catch {
    /* A provider may already have removed its frame. */
  }
  destroyPlayer = undefined;
  frame = undefined;
  target.value?.replaceChildren();
}
function update(next: 'embedded' | EmbedFailure, run: number) {
  if (!active || run !== generation) return;
  if (state.value !== 'loading' && state.value !== 'embedded') return;
  if (timer) clearTimeout(timer);
  state.value = next;
  if (next !== 'embedded') cleanup();
}
function receive(event: MessageEvent) {
  if (props.reference.provider !== 'TIKTOK') return;
  const result = tiktokMessage(event, frame?.contentWindow || null);
  if (result) update(result.state, generation);
}
async function load() {
  if (!enabled || !target.value || state.value === 'loading' || state.value === 'embedded') return;
  cleanup();
  const run = ++generation;
  state.value = 'loading';
  timer = setTimeout(() => update('failed', run), 20000);
  const reference = props.reference;
  try {
    if (reference.provider === 'INSTAGRAM') {
      const quote = document.createElement('blockquote');
      quote.className = 'instagram-media';
      quote.dataset.instgrmPermalink = reference.url;
      quote.dataset.instgrmVersion = '14';
      quote.setAttribute('data-instgrm-captioned', '');
      const link = document.createElement('a');
      link.href = reference.url;
      link.textContent = 'Instagram에서 보기';
      quote.append(link);
      const sdk = await loadInstagram();
      if (!active || run !== generation || state.value !== 'loading') return;
      if (!sdk) return update('failed', run);
      mutation = new MutationObserver(() => {
        const embedded = target.value?.querySelector('iframe');
        if (!embedded) return;
        mutation?.disconnect();
        frame = embedded;
        embedded.title = 'Instagram 게시물';
        const loaded = () => update('embedded', run);
        const error = () => update('failed', run);
        embedded.addEventListener('load', loaded, { once: true });
        embedded.addEventListener('error', error, { once: true });
        removeFrameListeners = () => {
          embedded.removeEventListener('load', loaded);
          embedded.removeEventListener('error', error);
        };
        // The frame owns content/deletion notices. load only proves the document loaded.
      });
      mutation.observe(target.value, { childList: true, subtree: true });
      target.value.append(quote);
      sdk.Embeds.process();
      return;
    }
    frame = document.createElement('iframe');
    frame.title = `${label.value} 게시물`;
    frame.allow = 'fullscreen; encrypted-media; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    const embedded = frame;
    const loaded = () => update('embedded', run);
    const error = () => update('failed', run);
    if (reference.provider === 'TIKTOK') embedded.addEventListener('load', loaded, { once: true });
    embedded.addEventListener('error', error, { once: true });
    removeFrameListeners = () => {
      embedded.removeEventListener('load', loaded);
      embedded.removeEventListener('error', error);
    };
    frame.src =
      reference.provider === 'YOUTUBE'
        ? `https://www.youtube.com/embed/${reference.id}?${new URLSearchParams({ enablejsapi: '1', origin: window.location.origin, autoplay: '0', playsinline: '1', start: String(reference.start) })}`
        : `https://www.tiktok.com/player/v1/${reference.id}?autoplay=0&description=1&music_info=1`;
    target.value.append(frame);
    if (reference.provider === 'YOUTUBE') {
      const sdk = await loadYouTube();
      if (!active || run !== generation || state.value !== 'loading' || !frame) return;
      if (!sdk) return update('failed', run);
      const player = new sdk.Player(frame, {
        events: {
          onReady: () => update('embedded', run),
          onError: (event) => update(youtubeFailure(event.data), run),
        },
      });
      destroyPlayer = () => player.destroy();
    }
  } catch {
    update('failed', run);
  }
}
onMounted(() => {
  if (!enabled || !root.value) return;
  window.addEventListener('message', receive);
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        void load();
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(root.value);
});
onBeforeUnmount(() => {
  active = false;
  generation++;
  observer?.disconnect();
  window.removeEventListener('message', receive);
  cleanup();
});
</script>

<template>
  <section
    ref="root"
    class="social-post"
    :class="{ vertical: reference.vertical, instagram: reference.provider === 'INSTAGRAM' }"
    :data-provider="reference.provider"
    :data-social-id="reference.id"
    :data-state="state"
    :aria-label="`${label} 게시물`"
  >
    <div ref="target" class="social-frame" :class="{ empty: state === 'idle' || failed }" />
    <div class="social-footer">
      <a :href="reference.url" target="_blank" rel="noopener noreferrer">{{ label }}에서 보기 ↗</a>
      <button v-if="failed" type="button" @click="load">다시 불러오기</button>
    </div>
    <p v-if="message" class="social-status" role="status">{{ message }}</p>
    <p v-if="state === 'embedded' && reference.provider !== 'YOUTUBE'" class="social-note">
      원문이 삭제되거나 비공개로 바뀐 경우 게시물을 볼 수 없습니다.
    </p>
  </section>
</template>

<style scoped>
.social-post {
  width: 100%;
  max-width: 650px;
  min-width: 0;
  margin: 24px auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.social-post.vertical {
  max-width: 400px;
}
.social-post.instagram {
  max-width: 540px;
}
.social-frame {
  min-height: 200px;
  aspect-ratio: 16 / 9;
}
.vertical .social-frame {
  aspect-ratio: 9 / 16;
}
.instagram .social-frame {
  aspect-ratio: auto;
}
.social-frame.empty {
  min-height: 0;
  aspect-ratio: auto;
}
.social-frame :deep(iframe) {
  display: block;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: 100%;
  border: 0;
  margin: 0 !important;
}
.instagram .social-frame :deep(iframe) {
  height: revert-layer;
}
.social-frame :deep(blockquote) {
  min-width: 0 !important;
  margin: 12px;
}
.social-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
}
.social-footer a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--brand-strong);
  font-weight: 700;
}
.social-footer button {
  min-height: 44px;
  font-size: 12px;
}
.social-status,
.social-note {
  margin: 0;
  padding: 0 14px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}
</style>
