import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parse } from '@vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
const require = createRequire(import.meta.url);
test('actual admin template renders scheduled immediate action and escaped per-file feedback', async () => {
  const source = await readFile(
    new URL('../apps/web/app/pages/admin.vue', import.meta.url),
    'utf8'
  );
  const { descriptor } = parse(source);
  const ssrRender = new Function(
    'require',
    compile(descriptor.template.content, { mode: 'function' }).code
  )(require);
  const render = async (postStatus, waiting = false) => {
    const app = createSSRApp({
      ssrRender,
      data: () => ({
        message: '업로드 실패',
        validation: {},
        collectAvailable: false,
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
        boards: { data: { items: [] } },
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
