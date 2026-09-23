import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
const require = createRequire(import.meta.url);
await test('actual admin template renders scheduled immediate action and escaped per-file feedback', async () => {
  const source = await readFile(
    new URL('../apps/web/app/pages/admin.vue', import.meta.url),
    'utf8'
  );
  const { descriptor } = parse(source);
  assert.ok(descriptor.template);
  const compiled: unknown = new Function(
    'require',
    compile(descriptor.template.content, { mode: 'function' }).code
  )(require);
  assert.ok(typeof compiled === 'function');
  const ssrRender = (...args: unknown[]) => {
    Reflect.apply(compiled, undefined, args);
  };
  const render = async (postStatus: string, waiting = false) => {
    const app = createSSRApp({
      ssrRender,
      data: () => ({
        message: '업로드 실패',
        validation: {},
        labels: { DRAFT: '초안', SCHEDULED: '예약됨' },
        locked: false,
        recovery: null,
        detailRetry: null,
        conflict: false,
        searchBusy: false,
        searchError: '',
        mobileEditor: false,
        taskLabel: '',
        imageFailures: {},
        imageAttempts: {},
        stateLabel(value: string) {
          return value;
        },
        boardName(value: string) {
          return value;
        },
        kst(value: string) {
          return value;
        },
        uploadErrors: [
          { index: 1, name: '<broken>.gif', reason: '파일 크기가 10MiB를 초과합니다.' },
        ],
        editor: { status: postStatus, postId: 1, lockVersion: 2, blocks: [], boardSlug: 'meme' },
        status: '',
        titlePrefix: '',
        board: '',
        from: '',
        to: '',
        page: 1,
        search: null,
        boards: { data: { items: [{ slug: 'meme', displayName: '짤' }] } },
        dirty: false,
        busy: false,
        editable: true,
        waiting,
        sourceName: '',
        sourceUrl: '',
        scheduled: '',
        republishPin: null,
        hideReason: 'RIGHTS_EMAIL',
        searchPosts() {},
        newDraft() {},
        load() {},
        move() {},
        removeBlock() {},
        upload() {},
        save() {},
        action() {},
        scheduleSlot() {},
      }),
    });
    app.component('PageNumbers', { render: () => null });
    app.component('NuxtLink', { template: '<a><slot /></a>' });
    return renderToString(app);
  };
  const scheduled = await render('SCHEDULED');
  assert.match(scheduled, />\s*즉시 발행\s*<\/button>/);
  assert.match(scheduled, /예약 취소/);
  assert.doesNotMatch(scheduled, /07:30 KST/);
  assert.match(scheduled, /&lt;broken&gt;\.gif: 파일 크기가 10MiB/);
  assert.match(scheduled, /role="alert"/);
  assert.doesNotMatch(await render('PUBLISHED'), />\s*즉시 발행\s*<\/button>/);
  const pending = await render('HIDDEN_REVIEW', true);
  assert.match(pending, /<fieldset disabled/);
  assert.match(pending, /<button disabled[^>]*>\s*재공개/);
  assert.doesNotMatch(await render('HIDDEN_REVIEW'), /<fieldset disabled/);
});
