<script setup lang="ts" generic="T extends string | boolean">
type Option = { value: T; label: string; disabled?: boolean };
const props = defineProps<{ modelValue: T; options: readonly Option[]; label: string; disabled?: boolean; enabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const id = useId(), trigger = ref<HTMLButtonElement>(), menu = ref<HTMLElement>();
const open = ref(false), active = ref(0), position = ref({ top: '0px', left: '0px', width: '160px', maxHeight: '264px' });
const selected = computed(() => props.options.find(option => option.value === props.modelValue));
function close() { open.value = false; }
function place() {
  if (!trigger.value) return;
  const rect = trigger.value.getBoundingClientRect(), width = Math.min(Math.max(rect.width, 160), window.innerWidth - 24);
  const height = Math.min(props.options.length * 44 + 12, 264), below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12, upward = below < height && above > below, available = upward ? above : below;
  position.value = { top: `${upward ? Math.max(12, rect.top - Math.min(height, available) - 6) : rect.bottom + 6}px`,
    left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, width: `${width}px`, maxHeight: `${Math.max(44, Math.min(height, available))}px` };
}
async function show() {
  if (props.disabled || !trigger.value) return;
  place();
  const index = props.options.findIndex(option => option.value === props.modelValue && !option.disabled);
  active.value = index >= 0 ? index : Math.max(0, props.options.findIndex(option => !option.disabled));
  open.value = true;
  await nextTick(); scrollActive();
}
function scrollActive() { menu.value?.querySelector<HTMLElement>(`[id="${id}-option-${active.value}"]`)?.scrollIntoView({ block: 'nearest' }); }
function pick(index: number) {
  const option = props.options[index];
  if (props.disabled || !option || option.disabled) return;
  emit('update:modelValue', option.value); close(); trigger.value?.focus();
}
async function move(direction: number) {
  for (let step = 1; step <= props.options.length; step++) {
    const index = (active.value + direction * step + props.options.length) % props.options.length;
    if (!props.options[index]?.disabled) { active.value = index; await nextTick(); scrollActive(); return; }
  }
}
async function keydown(event: KeyboardEvent) {
  if (props.disabled) return;
  if (event.key === 'Tab') { close(); return; }
  if (event.key === 'Escape') { if (open.value) { event.preventDefault(); event.stopPropagation(); close(); } return; }
  if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    if (!open.value) { await show(); return; }
    if (event.key === 'Enter' || event.key === ' ') { pick(active.value); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { await move(event.key === 'ArrowDown' ? 1 : -1); return; }
    const indices = props.options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
    active.value = (event.key === 'Home' ? indices[0] : indices.at(-1)) ?? 0; await nextTick(); scrollActive();
  } else if (event.key.length === 1) {
    const index = props.options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
    if (index >= 0) { event.preventDefault(); if (!open.value) await show(); active.value = index; scrollActive(); }
  }
}
watch(() => props.disabled, disabled => { if (disabled) close(); });
watch(open, (visible, _, cleanup) => {
  if (!visible) return;
  const outside = (event: PointerEvent) => { if (event.target instanceof Node && !trigger.value?.contains(event.target) && !menu.value?.contains(event.target)) close(); };
  const scroll = (event: Event) => { if (event.target instanceof Node && menu.value?.contains(event.target)) return; place(); };
  window.addEventListener('pointerdown', outside); window.addEventListener('scroll', scroll, true); window.addEventListener('resize', place);
  cleanup(() => { window.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', place); });
});
</script>
<template>
  <button ref="trigger" class="setting-select" :class="{ 'is-enabled': enabled, 'is-open': open }" type="button" role="combobox"
    :aria-label="label" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="open ? `${id}-list` : undefined"
    :aria-activedescendant="open ? `${id}-option-${active}` : undefined" :disabled="disabled"
    @click="open ? close() : show()" @keydown="keydown" @blur="close">
    <span v-if="typeof modelValue === 'boolean'" class="state-dot" aria-hidden="true" />
    <span>{{ selected?.label }}</span>
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
  </button>
  <Teleport to="body">
    <div v-if="open" :id="`${id}-list`" ref="menu" class="setting-options" role="listbox" :aria-label="label" :style="position" @mousedown.prevent>
      <div v-for="(option, index) in options" :id="`${id}-option-${index}`" :key="String(option.value)" class="setting-option"
        :class="{ 'is-active': index === active }" role="option" :aria-selected="option.value === modelValue" :aria-disabled="option.disabled || undefined"
        @pointermove="!option.disabled && (active = index)" @click="pick(index)">
        <span>{{ option.label }}</span>
        <svg v-if="option.value === modelValue" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.setting-select { display: inline-flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px; background: #fff; color: var(--muted); font-size: 13px; font-weight: 600; text-align: left; line-height: 1.5; }
.setting-select > span:not(.state-dot) { flex: 1; }
.setting-select.is-enabled { border-color: #a5d9d6; background: var(--brand-soft); color: var(--brand-strong); }
.setting-select:hover:not(:disabled), .setting-select.is-open { border-color: var(--brand-strong); }
.setting-select:disabled { background: #f0f3f4; cursor: not-allowed; opacity: .65; }
.state-dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--line-strong); }
.is-enabled .state-dot { background: var(--brand); }
svg { width: 16px; height: 16px; flex: none; }
path { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.setting-options { position: fixed; z-index: 1000; padding: 5px; overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--line); border-radius: 10px; background: #fff; box-shadow: 0 8px 24px rgb(27 38 44 / 16%); }
.setting-option { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; padding: 10px; border-radius: 6px; font-size: 14px; color: var(--muted); cursor: pointer; }
.setting-option[aria-selected='true'] { color: var(--brand-strong); font-weight: 600; }
.setting-option.is-active:not([aria-disabled='true']) { background: var(--brand-soft); color: var(--brand-strong); }
.setting-option[aria-disabled='true'] { color: #9aa5aa; cursor: not-allowed; }
</style>
