import { createServer, type ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { consumeEventRateLimit } from '../server/utils/publicEvent'

const requestId = '9c201898-5465-4186-a62f-667ddfc50fd1'
const requestedUrls: string[] = []
let coreMode: 'normal' | 'malformed' | 'disconnect' = 'normal'
let receivedEvent: unknown = null

const coreServer = createServer((request, response) => {
  const url = request.url ?? '/'
  requestedUrls.push(url)

  if (coreMode === 'disconnect') {
    request.socket.destroy()
    return
  }
  if (coreMode === 'malformed') {
    return json(response, 200, { success: true, data: { internalStorageKey: 'private/key' } })
  }
  if (url === '/internal/health/ready') return json(response, 200, { status: 'READY' })
  if (url === '/internal/v1/policies/privacy') {
    return json(response, 200, {
      success: true,
      data: {
        policy: {
          type: 'privacy',
          version: 'v0.2',
          title: '개인정보처리방침',
          bodyHtml: '<h2>본문</h2>',
          effectiveAt: '2026-08-01T00:00:00.000Z',
          endedAt: null,
          draftSource: 'private',
        },
        history: [
          { version: 'v0.2', effectiveAt: '2026-08-01T00:00:00.000Z', endedAt: null },
        ],
        internalPolicyId: 2,
      },
      meta: { requestId, coreOnly: true },
    })
  }
  if (url === '/internal/v1/events' && request.method === 'POST') {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      receivedEvent = JSON.parse(raw)
      response.writeHead(204, { 'x-request-id': requestId, 'cache-control': 'no-store' })
      response.end()
    })
    return
  }
  if (url === '/internal/v1/boards') {
    return json(response, 200, {
      success: true,
      data: {
        items: [
          {
            slug: 'meme',
            displayName: '짤',
            postingPolicy: 'ADMIN',
            path: '/meme',
            internalBoardId: 1,
          },
        ],
        internalQuery: 'select * from content.board',
      },
      meta: { requestId, coreOnly: true },
    })
  }
  if (url === '/internal/v1/boards/meme/posts?page=2') {
    return json(response, 200, {
      success: true,
      data: {
        board: { slug: 'meme', displayName: '짤', id: 1 },
        pinnedItems: [],
        items: [listItem(1047)],
        storageKey: 'private/posts/1047/source.webp',
      },
      meta: {
        requestId,
        page: 2,
        pageSize: 20,
        totalItems: 21,
        totalPages: 2,
        hasPrevious: true,
        hasNext: false,
        sqlDurationMs: 3,
      },
    })
  }
  if (url === '/internal/v1/boards/meme/posts/1047') {
    return json(response, 200, {
      success: true,
      data: {
        post: {
          postId: 1047,
          board: { slug: 'meme', displayName: '짤', id: 1 },
          title: '테스트 글',
          authorLabel: '운영자',
          publishedAt: '2026-08-15T00:00:00.000Z',
          viewCount: 10,
          blocks: [
            { type: 'TEXT', text: '본문', rawHtml: '<script>alert(1)</script>' },
            {
              type: 'IMAGE',
              image: {
                url: 'https://img.test/posts/1047/hash.webp',
                alt: '이미지',
                width: 1200,
                height: 900,
                privateStorageKey: 'private/key',
              },
            },
          ],
          source: { name: 'example.com', url: 'https://example.com/source', fetchedBy: 'admin' },
          shareUrl: 'https://test.local/meme/posts/1047',
          status: 'PUBLISHED',
        },
        context: {
          pinnedItems: [],
          listPage: 1,
          items: [{ ...listItem(1047), current: true }],
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          internalCursor: 'secret',
        },
      },
      meta: { requestId },
    })
  }
  if (url === '/internal/v1/boards/missing/posts?page=1') {
    return json(response, 404, {
      success: false,
      error: {
        code: 'BOARD_NOT_FOUND',
        message: '게시판을 찾을 수 없습니다.',
        fields: [],
        internalReason: 'inactive',
      },
      meta: { requestId, trace: 'internal' },
      stack: 'do not expose',
    })
  }

  return json(response, 404, {
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: '요청한 경로를 찾을 수 없습니다.', fields: [] },
    meta: { requestId },
  })
})

await new Promise<void>((resolve) => coreServer.listen(0, '127.0.0.1', resolve))
const address = coreServer.address()
if (!address || typeof address === 'string') throw new Error('Mock Core server failed to start')

describe('Nuxt public BFF', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('..', import.meta.url)),
    browser: false,
    env: {
      NUXT_CORE_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      NUXT_CORE_API_TIMEOUT_MS: '1000',
      NUXT_ADMIN_IDENTITY_PROVIDER: 'cloudflare-access',
      NUXT_ADMIN_OPERATOR_ID: 'operator-1',
      NUXT_CLOUDFLARE_ACCESS_AUDIENCE: '0123456789abcdef0123456789abcdef',
      NUXT_CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://blariyo.cloudflareaccess.com',
    },
  })

  beforeEach(() => {
    requestedUrls.length = 0
    coreMode = 'normal'
    receivedEvent = null
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      coreServer.close((error) => (error ? reject(error) : resolve())),
    )
  })

  it('BFF 생존·준비 상태를 분리한다', async () => {
    const live = await fetch('/health/live')
    expect(live.status).toBe(200)
    expect(await live.json()).toEqual({ status: 'UP' })
    expect(live.headers.get('cache-control')).toBe('no-store')

    const ready = await fetch('/health/ready')
    expect(ready.status).toBe(200)
    expect(await ready.json()).toEqual({ status: 'READY' })
  })

  it('활성 게시판 응답에서 외부 계약 필드만 노출한다', async () => {
    const response = await fetch('/api/v1/boards')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(body).toEqual({
      success: true,
      data: {
        items: [{ slug: 'meme', displayName: '짤', postingPolicy: 'ADMIN', path: '/meme' }],
      },
      meta: { requestId },
    })
  })

  it('게시판 nested 목록의 page만 Core에 전달한다', async () => {
    const response = await fetch('/api/v1/boards/meme/posts?page=2')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(requestedUrls).toEqual(['/internal/v1/boards/meme/posts?page=2'])
    expect(body.data.board).toEqual({ slug: 'meme', displayName: '짤' })
    expect(body.data.items).toEqual([listItem(1047)])
    expect(body.data.storageKey).toBeUndefined()
    expect(body.meta.sqlDurationMs).toBeUndefined()
  })

  it('게시판 소속 상세를 전달하고 내부 상태·storage key를 제거한다', async () => {
    const response = await fetch('/api/v1/boards/meme/posts/1047')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(requestedUrls).toEqual(['/internal/v1/boards/meme/posts/1047'])
    expect(body.data.post.status).toBeUndefined()
    expect(body.data.post.board.id).toBeUndefined()
    expect(body.data.post.blocks[0]).toEqual({ type: 'TEXT', text: '본문' })
    expect(body.data.post.blocks[1].image.privateStorageKey).toBeUndefined()
    expect(body.data.context.internalCursor).toBeUndefined()
  })

  it('잘못된 path와 query는 Core 호출 없이 공개 오류로 정규화한다', async () => {
    const invalidList = await fetch('/api/v1/boards/INVALID/posts?page=1')
    expect(invalidList.status).toBe(404)
    expect((await invalidList.json()).error.code).toBe('BOARD_NOT_FOUND')

    const invalidPage = await fetch('/api/v1/boards/meme/posts?page=0')
    expect(invalidPage.status).toBe(400)
    expect(await invalidPage.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', fields: [{ field: 'page', reason: 'integerRange' }] },
    })

    const invalidDetail = await fetch('/api/v1/boards/meme/posts/not-a-number')
    expect(invalidDetail.status).toBe(404)
    expect((await invalidDetail.json()).error.code).toBe('POST_NOT_FOUND')
    expect(requestedUrls).toEqual([])
  })

  it('Core 오류도 허용된 오류 필드만 전달한다', async () => {
    const response = await fetch('/api/v1/boards/missing/posts')
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toEqual({
      success: false,
      error: { code: 'BOARD_NOT_FOUND', message: '게시판을 찾을 수 없습니다.', fields: [] },
      meta: { requestId },
    })
  })

  it('정책 응답에서 공개 계약 필드만 전달한다', async () => {
    const response = await fetch('/api/v1/policies/privacy')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300')
    expect(body.data.policy).toEqual({
      type: 'privacy',
      version: 'v0.2',
      title: '개인정보처리방침',
      bodyHtml: '<h2>본문</h2>',
      effectiveAt: '2026-08-01T00:00:00.000Z',
      endedAt: null,
    })
    expect(body.data.internalPolicyId).toBeUndefined()
    expect(body.data.policy.draftSource).toBeUndefined()
  })

  it('이벤트를 검증해 Core에 전달하고 성공 body를 노출하지 않는다', async () => {
    const payload = {
      eventType: 'POST_VIEW',
      anonymousId: 'anonymous-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      sessionId: 'session-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      boardSlug: 'meme',
      postId: 1047,
      occurredAt: new Date().toISOString(),
    }
    const response = await fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.11' },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(receivedEvent).toEqual(payload)

    requestedUrls.length = 0
    const invalid = await fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.12' },
      body: JSON.stringify({ ...payload, listPage: 1 }),
    })
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).error).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'listPage', reason: 'notAllowed' }],
    })
    expect(requestedUrls).toEqual([])

    const malformed = await fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.13' },
      body: '{',
    })
    expect(malformed.status).toBe(400)
    expect((await malformed.json()).error).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'body', reason: 'invalidJson' }],
    })
    expect(requestedUrls).toEqual([])
  })

  it('이벤트 IP 제한은 분당 60회이고 다음 window에 초기화된다', () => {
    const ip = `unit-${Date.now()}`
    for (let count = 0; count < 60; count += 1) {
      expect(consumeEventRateLimit(ip, 1_000)).toBe(true)
    }
    expect(consumeEventRateLimit(ip, 1_000)).toBe(false)
    expect(consumeEventRateLimit(ip, 61_000)).toBe(true)
  })

  it('Core 비정상 응답·연결 장애는 상세 원인 없는 503이다', async () => {
    coreMode = 'malformed'
    const malformed = await fetch('/api/v1/boards')
    expect(malformed.status).toBe(503)
    expect(await malformed.json()).toMatchObject({ error: { code: 'DEPENDENCY_UNAVAILABLE' } })

    coreMode = 'disconnect'
    const disconnected = await fetch('/api/v1/boards')
    expect(disconnected.status).toBe(503)
    expect(await disconnected.json()).toMatchObject({ error: { code: 'DEPENDENCY_UNAVAILABLE' } })
  })

  it('게시판 문맥 없는 공개 게시글 route를 만들지 않는다', async () => {
    expect((await fetch('/api/v1/posts')).status).toBe(404)
    expect((await fetch('/api/v1/posts/1047')).status).toBe(404)
  })

  it('관리자 페이지와 API는 외부 assertion 없이는 Core 호출 전에 거부한다', async () => {
    for (const path of ['/admin', '/api/v1/admin/posts']) {
      requestedUrls.length = 0
      const response = await fetch(path, { headers: { accept: 'application/json' } })
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect((await response.json()).error.code).toBe('ADMIN_AUTH_REQUIRED')
      expect(requestedUrls).toEqual([])
    }
  })
})

function listItem(postId: number) {
  return {
    postId,
    title: '테스트 글',
    viewCount: 10,
    authorLabel: '운영자',
    publishedAt: '2026-08-15T00:00:00.000Z',
    path: `/meme/posts/${postId}`,
  }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status >= 400 ? 'no-store' : 'public, max-age=60',
    'x-request-id': requestId,
  })
  response.end(JSON.stringify(body))
}
