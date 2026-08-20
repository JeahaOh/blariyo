import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type { H3Event } from 'h3'
import { $fetch as ofetch } from 'ofetch'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { proxyAdminGet, proxyAdminImagePreview, proxyAdminJson } from '../server/utils/adminCoreApi'
import {
  mapAdminImageDiscardResponse,
  mapAdminImageUploadResponse,
  mapAdminPostCreatedResponse,
  mapAdminPostDetailResponse,
  mapAdminPostPublishResponse,
  mapAdminPostsResponse,
  mapAdminPostTransitionResponse,
  mapAdminPostUpdatedResponse,
} from '../server/utils/adminPostMapping'

if (process.env.RUN_BFF_CORE_INTEGRATION !== '1') {
  throw new Error('Run with npm run test:integration:bff-core')
}

const database = {
  host: process.env.MIGRATION_DB_HOST || '127.0.0.1',
  port: Number(process.env.MIGRATION_DB_PORT || 45434),
  database: process.env.MIGRATION_DB_NAME || 'blariyo_migration_test',
  user: process.env.MIGRATION_DB_USER || 'blariyo_migration_test',
  password: process.env.MIGRATION_DB_PASSWORD || 'blariyo_migration_test',
}

Object.assign(process.env, {
  MIGRATION_DB_HOST: database.host,
  MIGRATION_DB_PORT: String(database.port),
  MIGRATION_DB_NAME: database.database,
  MIGRATION_DB_USER: database.user,
  MIGRATION_DB_PASSWORD: database.password,
})

const requireFromApi = createRequire(
  fileURLToPath(new URL('../../api/package.json', import.meta.url)),
)
const { Pool } = requireFromApi('pg')
const createCoreApp = requireFromApi('./src/core/createApp')
const { migrate } = requireFromApi('./src/db/migrate')
const { seedPublicContent } = requireFromApi('./tests/fixtures/publicContentFixture')
const eventHmacSecret = 'test-event-hmac-secret-with-at-least-32-bytes'
const coreServiceToken = 'test-core-service-token-with-at-least-32-bytes'
const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const privateObjects = new Map<string, Buffer>()
const privateMediaStorage = {
  put: async (key: string, body: Buffer) => privateObjects.set(key, Buffer.from(body)),
  get: async (key: string) => {
    const body = privateObjects.get(key)
    if (!body) throw new Error('Object not found')
    return Buffer.from(body)
  },
  delete: async (key: string) => privateObjects.delete(key),
}

await migrate()
const pool = new Pool({ ...database, max: 5 })
await seedPublicContent(pool)

const coreApp = createCoreApp({
  pool,
  mediaBaseUrl: 'https://img.test.local',
  serviceBaseUrl: 'https://test.local',
  eventHmacSecret,
  coreServiceToken,
  privateMediaStorage,
})
const coreServer = createServer(coreApp)
await new Promise<void>((resolve) => coreServer.listen(0, '127.0.0.1', resolve))
const coreAddress = coreServer.address()
if (!coreAddress || typeof coreAddress === 'string') {
  throw new Error('Core API integration server failed to start')
}

describe('PostgreSQL - Core API - Nuxt BFF integration', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('..', import.meta.url)),
    browser: false,
    env: {
      NUXT_CORE_API_BASE_URL: `http://127.0.0.1:${coreAddress.port}`,
      NUXT_CORE_API_TIMEOUT_MS: '3000',
      NUXT_PUBLIC_SITE_BASE_URL: 'https://test.local',
    },
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      coreServer.close((error) => (error ? reject(error) : resolve())),
    )
    await pool.end()
  })

  it('BFF readiness가 실제 Core migration 준비 상태를 반영한다', async () => {
    const response = await fetch('/health/ready')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'READY' })
  })

  it('PostgreSQL의 활성 게시판을 BFF 외부 계약으로 조회한다', async () => {
    const response = await fetch('/api/v1/boards')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.items).toEqual([
      { slug: 'meme', displayName: '짤', postingPolicy: 'ADMIN', path: '/meme' },
      { slug: 'empty', displayName: '빈 게시판', postingPolicy: 'ADMIN', path: '/empty' },
      { slug: 'other', displayName: '다른 게시판', postingPolicy: 'ADMIN', path: '/other' },
    ])
    expect(body.meta.requestId).toBe(response.headers.get('x-request-id'))
  })

  it('게시판 nested 목록에서 공지와 일반 글을 분리한다', async () => {
    const response = await fetch('/api/v1/boards/meme/posts?page=1')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=60')
    expect(body.data.board).toEqual({ slug: 'meme', displayName: '짤' })
    expect(body.data.pinnedItems.map((item: { postId: number }) => item.postId)).toEqual([12])
    expect(body.data.items.map((item: { postId: number }) => item.postId)).toEqual([1047, 1046])
    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    })
  })

  it('게시판 소속 상세와 text/image block을 BFF까지 전달한다', async () => {
    const response = await fetch('/api/v1/boards/meme/posts/1047')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(body.data.post).toMatchObject({
      postId: 1047,
      board: { slug: 'meme', displayName: '짤' },
      title: '공개 일반 글 1047',
      source: { name: 'example.com', url: 'https://example.com/source/1047' },
      shareUrl: 'https://test.local/meme/posts/1047',
    })
    expect(body.data.post.blocks).toEqual([
      { type: 'TEXT', text: '본문 텍스트' },
      {
        type: 'IMAGE',
        image: {
          url: 'https://img.test.local/posts/1047/hash.webp',
          alt: '테스트 이미지',
          width: 1200,
          height: 900,
        },
      },
    ])
    expect(body.data.context.items.find((item: { postId: number }) => item.postId === 1047).current)
      .toBe(true)
  })

  it('게시판 미존재·소속 불일치·비공개 글을 외부 404로 유지한다', async () => {
    const cases = [
      ['/api/v1/boards/missing/posts', 'BOARD_NOT_FOUND'],
      ['/api/v1/boards/other/posts/1047', 'POST_NOT_FOUND'],
      ['/api/v1/boards/meme/posts/1045', 'POST_NOT_FOUND'],
      ['/api/v1/boards/meme/posts/1043', 'POST_NOT_FOUND'],
      ['/api/v1/boards/meme/posts/1042', 'POST_NOT_FOUND'],
    ]

    for (const [path, code] of cases) {
      const response = await fetch(path)
      const body = await response.json()
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(body.error.code).toBe(code)
      expect(body.meta.requestId).toBe(response.headers.get('x-request-id'))
    }
  })

  it('PostgreSQL 정책 버전을 BFF 공개 계약으로 조회한다', async () => {
    const current = await fetch('/api/v1/policies/privacy')
    const currentBody = await current.json()
    expect(current.status).toBe(200)
    expect(current.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=300')
    expect(currentBody.data.policy).toMatchObject({
      type: 'privacy',
      version: 'v0.2',
      title: '개인정보처리방침',
      endedAt: null,
    })
    expect(currentBody.data.history.map((item: { version: string }) => item.version)).toEqual(['v0.2', 'v0.1'])

    const previous = await fetch('/api/v1/policies/privacy?version=v0.1')
    expect((await previous.json()).data.policy.version).toBe('v0.1')
  })

  it('BFF 이벤트를 Core에서 HMAC 원시 이벤트로 저장한다', async () => {
    await pool.query('TRUNCATE analytics.raw_event, analytics.daily_event_metric')
    const response = await fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.22' },
      body: JSON.stringify({
        eventType: 'POST_VIEW',
        anonymousId: 'anonymous-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sessionId: 'session-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        boardSlug: 'meme',
        postId: 1047,
        occurredAt: new Date().toISOString(),
      }),
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBeTruthy()

    const stored = await pool.query(
      'SELECT type, anonymous_hmac, session_hmac FROM analytics.raw_event',
    )
    expect(stored.rowCount).toBe(1)
    expect(stored.rows[0].type).toBe('POST_VIEW')
    expect(stored.rows[0].anonymous_hmac).toHaveLength(32)
    expect(stored.rows[0].session_hmac).toHaveLength(32)
  })

  it('BFF 관리자 proxy가 내부 인증 header로 Core 검색·상세를 조회한다', async () => {
    vi.stubGlobal('$fetch', ofetch)
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: `http://127.0.0.1:${coreAddress.port}`,
      coreApiTimeoutMs: 3000,
      coreServiceToken,
      adminActorHmacSecret: 'test-admin-actor-secret-with-at-least-32-bytes',
    }))
    const setResponseStatus = vi.fn()
    const setHeader = vi.fn()
    vi.stubGlobal('setResponseStatus', setResponseStatus)
    vi.stubGlobal('setHeader', setHeader)
    const event = { context: { adminPrincipal: { operatorId: 'operator-1' } } } as unknown as H3Event

    try {
      const list = await proxyAdminGet(event, {
        path: '/internal/v1/admin/posts?status=DRAFT&page=1',
        mapSuccess: mapAdminPostsResponse,
      }) as ReturnType<typeof mapAdminPostsResponse>
      expect(list.data.items).toHaveLength(1)
      expect(list.data.items[0]).toMatchObject({ postId: 1044, status: 'DRAFT' })

      const detail = await proxyAdminGet(event, {
        path: '/internal/v1/admin/posts/1047',
        mapSuccess: mapAdminPostDetailResponse,
      }) as ReturnType<typeof mapAdminPostDetailResponse>
      expect(detail.data).toMatchObject({ postId: 1047, boardSlug: 'meme', status: 'PUBLISHED' })
      expect(detail.data.blocks[1]).toMatchObject({
        type: 'IMAGE',
        image: { imageId: 501, previewPath: '/api/v1/admin/images/501/preview' },
      })
      expect(setResponseStatus).toHaveBeenCalledWith(event, 200)
      expect(setHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('BFF 관리자 command가 Core에서 초안을 생성하고 lockVersion으로 수정한다', async () => {
    vi.stubGlobal('$fetch', ofetch)
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: `http://127.0.0.1:${coreAddress.port}`,
      coreApiTimeoutMs: 3000,
      coreServiceToken,
      adminActorHmacSecret: 'test-admin-actor-secret-with-at-least-32-bytes',
    }))
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())
    const event = { context: { adminPrincipal: { operatorId: 'operator-command' } } } as unknown as H3Event
    let postId: number | undefined

    try {
      const created = await proxyAdminJson(event, {
        path: '/internal/v1/admin/posts',
        method: 'POST',
        body: {
          boardSlug: 'meme',
          title: 'BFF 통합 초안',
          source: null,
          blocks: [{ type: 'TEXT', text: '<tag> 문자열 본문' }],
          pinnedPosition: null,
        },
        headers: { 'Idempotency-Key': `bff-command-${Date.now()}` },
        mapSuccess: mapAdminPostCreatedResponse,
      }) as ReturnType<typeof mapAdminPostCreatedResponse>
      postId = created.data.postId
      expect(created.data).toEqual({ postId, status: 'DRAFT', lockVersion: 1 })

      const updated = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}`,
        method: 'PATCH',
        body: { lockVersion: 1, title: 'BFF 통합 수정' },
        mapSuccess: mapAdminPostUpdatedResponse,
      }) as ReturnType<typeof mapAdminPostUpdatedResponse>
      expect(updated.data).toMatchObject({ postId, status: 'DRAFT', lockVersion: 2 })

      const stored = await pool.query(
        'SELECT title, lock_version FROM content.board_post WHERE id = $1',
        [postId],
      )
      expect(stored.rows).toEqual([{ title: 'BFF 통합 수정', lock_version: 2 }])
    } finally {
      if (postId) {
        await pool.query('DELETE FROM ops.idempotency_request WHERE resource_id = $1', [postId])
        await pool.query('DELETE FROM content.board_post_status_history WHERE post_id = $1', [postId])
        await pool.query('DELETE FROM content.board_post_block WHERE post_id = $1', [postId])
        await pool.query('DELETE FROM content.board_post WHERE id = $1', [postId])
      }
      vi.unstubAllGlobals()
    }
  })

  it('BFF 관리자 lifecycle command가 예약·취소·발행·숨김·재공개·최종 삭제를 Core에 연결한다', async () => {
    vi.stubGlobal('$fetch', ofetch)
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: `http://127.0.0.1:${coreAddress.port}`,
      coreApiTimeoutMs: 3000,
      coreServiceToken,
      adminActorHmacSecret: 'test-admin-actor-secret-with-at-least-32-bytes',
    }))
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())
    const event = { context: { adminPrincipal: { operatorId: 'operator-lifecycle' } } } as unknown as H3Event
    let postId: number | undefined
    const key = (name: string) => `${name}-${Date.now()}`

    try {
      const created = await proxyAdminJson(event, {
        path: '/internal/v1/admin/posts',
        method: 'POST',
        body: {
          boardSlug: 'meme',
          title: 'BFF lifecycle 글',
          blocks: [{ type: 'TEXT', text: '본문' }],
        },
        headers: { 'Idempotency-Key': key('create') },
        mapSuccess: mapAdminPostCreatedResponse,
      }) as ReturnType<typeof mapAdminPostCreatedResponse>
      postId = created.data.postId

      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()
      const scheduled = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/publish`,
        method: 'POST',
        body: { lockVersion: 1, mode: 'SCHEDULED', scheduledAt },
        headers: { 'Idempotency-Key': key('schedule') },
        mapSuccess: mapAdminPostPublishResponse,
      }) as ReturnType<typeof mapAdminPostPublishResponse>
      expect(scheduled.data).toMatchObject({ status: 'SCHEDULED', lockVersion: 2 })

      const unscheduled = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/unschedule`,
        method: 'POST',
        body: { lockVersion: 2 },
        headers: { 'Idempotency-Key': key('unschedule') },
        mapSuccess: mapAdminPostTransitionResponse,
      }) as ReturnType<typeof mapAdminPostTransitionResponse>
      expect(unscheduled.data).toMatchObject({ status: 'DRAFT', lockVersion: 3, scheduledAt: null })

      const published = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/publish`,
        method: 'POST',
        body: { lockVersion: 3, mode: 'IMMEDIATE' },
        headers: { 'Idempotency-Key': key('publish') },
        mapSuccess: mapAdminPostPublishResponse,
      }) as ReturnType<typeof mapAdminPostPublishResponse>
      expect(published.data).toMatchObject({ status: 'PUBLISHED', lockVersion: 4 })

      const hidden = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/hide`,
        method: 'POST',
        body: { lockVersion: 4, reasonCode: 'RIGHTS_EMAIL' },
        headers: { 'Idempotency-Key': key('hide') },
        mapSuccess: mapAdminPostTransitionResponse,
      }) as ReturnType<typeof mapAdminPostTransitionResponse>
      expect(hidden.data).toMatchObject({ status: 'HIDDEN_REVIEW', lockVersion: 5 })

      const republished = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/republish`,
        method: 'POST',
        body: { lockVersion: 5, pinnedPosition: null },
        headers: { 'Idempotency-Key': key('republish') },
        mapSuccess: mapAdminPostTransitionResponse,
      }) as ReturnType<typeof mapAdminPostTransitionResponse>
      expect(republished.data).toMatchObject({ status: 'PUBLISHED', lockVersion: 6 })

      const hiddenAgain = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}/hide`,
        method: 'POST',
        body: { lockVersion: 6, reasonCode: 'RIGHTS_EMAIL' },
        headers: { 'Idempotency-Key': key('hide-again') },
        mapSuccess: mapAdminPostTransitionResponse,
      }) as ReturnType<typeof mapAdminPostTransitionResponse>
      expect(hiddenAgain.data).toMatchObject({ status: 'HIDDEN_REVIEW', lockVersion: 7 })

      const removed = await proxyAdminJson(event, {
        path: `/internal/v1/admin/posts/${postId}`,
        method: 'DELETE',
        body: { lockVersion: 7, reasonCode: 'RIGHTS_EMAIL' },
        headers: { 'Idempotency-Key': key('remove') },
        mapSuccess: mapAdminPostTransitionResponse,
      }) as ReturnType<typeof mapAdminPostTransitionResponse>
      expect(removed.data).toMatchObject({ status: 'REMOVED', lockVersion: 8 })
    } finally {
      if (postId) {
        await pool.query('DELETE FROM ops.idempotency_request WHERE resource_id = $1', [postId])
        await pool.query("DELETE FROM ops.outbox_task WHERE aggregate_type = 'POST' AND aggregate_id = $1", [postId])
        await pool.query('DELETE FROM content.board_post_status_history WHERE post_id = $1', [postId])
        await pool.query('DELETE FROM content.board_post_block WHERE post_id = $1', [postId])
        await pool.query('DELETE FROM content.board_post WHERE id = $1', [postId])
      }
      vi.unstubAllGlobals()
    }
  })

  it('BFF 관리자 image proxy가 multipart 업로드·private preview·폐기를 연결한다', async () => {
    vi.stubGlobal('$fetch', ofetch)
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: `http://127.0.0.1:${coreAddress.port}`,
      coreApiTimeoutMs: 3000,
      coreServiceToken,
      adminActorHmacSecret: 'test-admin-actor-secret-with-at-least-32-bytes',
    }))
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())
    const event = { context: { adminPrincipal: { operatorId: 'operator-image' } } } as unknown as H3Event
    const boundary = `----blariyo-${Date.now()}`
    const multipart = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="pixel.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      testPng,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    let imageId: number | undefined

    try {
      const uploaded = await proxyAdminJson(event, {
        path: '/internal/v1/admin/images',
        method: 'POST',
        body: multipart,
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        mapSuccess: mapAdminImageUploadResponse,
      }) as ReturnType<typeof mapAdminImageUploadResponse>
      imageId = uploaded.data.items[0].imageId
      expect(uploaded.data.items[0]).toMatchObject({
        imageId,
        status: 'STAGED',
        mimeType: 'image/png',
        width: 1,
        height: 1,
      })

      const preview = await proxyAdminImagePreview(
        event,
        `/internal/v1/admin/images/${imageId}/preview`,
      )
      expect(preview).toEqual(testPng)

      const discarded = await proxyAdminJson(event, {
        path: `/internal/v1/admin/images/${imageId}`,
        method: 'DELETE',
        mapSuccess: mapAdminImageDiscardResponse,
      }) as ReturnType<typeof mapAdminImageDiscardResponse>
      expect(discarded.data).toEqual({ imageId, status: 'PRIVATE_DELETE_PENDING' })
    } finally {
      if (imageId) {
        await pool.query("DELETE FROM ops.outbox_task WHERE aggregate_type = 'IMAGE' AND aggregate_id = $1", [imageId])
        await pool.query('DELETE FROM content.board_post_image WHERE id = $1', [imageId])
      }
      vi.unstubAllGlobals()
    }
  })

  it('루트는 게시판 목록으로 redirect하고 목록을 SSR HTML에 포함한다', async () => {
    const root = await fetch('/', { redirect: 'manual' })
    expect(root.status).toBe(307)
    expect(root.headers.get('location')).toBe('/meme')

    const response = await fetch('/meme')
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('<h1>짤</h1>')
    expect(html).toContain('공개 일반 글 1047')
    expect(html).toContain('rel="canonical" href="https://test.local/meme"')
  })

  it('상세 canonical·OG·본문을 첫 SSR HTML에 렌더링한다', async () => {
    const response = await fetch('/meme/posts/1047')
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('공개 일반 글 1047')
    expect(html).toContain('본문 텍스트')
    expect(html).toContain('https://img.test.local/posts/1047/hash.webp')
    expect(html).toContain('rel="canonical" href="https://test.local/meme/posts/1047"')
    expect(html).toContain('property="og:type" content="article"')
    expect(html).toContain('property="og:url" content="https://test.local/meme/posts/1047"')
  })

  it('비공개·게시판 불일치 상세의 404 HTML에 콘텐츠를 남기지 않는다', async () => {
    for (const path of ['/meme/posts/1045', '/other/posts/1047']) {
      const response = await fetch(path, { headers: { accept: 'text/html' } })
      const html = await response.text()
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(html).toContain('볼 수 없는 게시글입니다')
      expect(html).toContain('name="robots" content="noindex, nofollow"')
      expect(html).not.toContain('숨김 글')
      expect(html).not.toContain('공개 일반 글 1047')
      expect(html).not.toContain('본문 텍스트')
      expect(html).not.toContain('posts/1047/hash.webp')
    }
  })
})
