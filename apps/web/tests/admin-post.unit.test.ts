import type { H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyAdminGet, proxyAdminJson } from '../server/utils/adminCoreApi'
import {
  mapAdminPostCreatedResponse,
  mapAdminPostDetailResponse,
  mapAdminPostsResponse,
} from '../server/utils/adminPostMapping'
import {
  validateAdminPostCreate,
  validateAdminPostUpdate,
  validateIdempotencyKey,
} from '../server/utils/adminPostCommandValidation'
import {
  validateAdminPostHide,
  validateAdminPostPublish,
  validateAdminPostRemove,
  validateAdminPostRepublish,
  validateAdminPostUnschedule,
} from '../server/utils/adminPostLifecycleValidation'
import { validateAdminPostSearch } from '../server/utils/adminPostValidation'
import {
  adminPostStatusLabel,
  commandBlocks,
  editableAdminPost,
  editorBlocks,
} from '../app/utils/adminPostEditor'

afterEach(() => vi.unstubAllGlobals())

describe('admin post BFF contract', () => {
  it('관리자 편집 화면이 상세 block을 저장 command 형식으로 왕복 변환한다', () => {
    let key = 0
    const editor = editorBlocks([
      { type: 'TEXT', text: '본문' },
      {
        type: 'IMAGE',
        image: {
          imageId: 501,
          status: 'PRIVATE_REVIEW',
          alt: '이미지 설명',
          width: 1200,
          height: 900,
          previewPath: '/api/v1/admin/images/501/preview',
        },
      },
    ], () => `block-${++key}`)
    expect(editor[1]).toMatchObject({
      key: 'block-2',
      type: 'IMAGE',
      imageId: 501,
      stagedInEditor: false,
    })
    expect(commandBlocks(editor)).toEqual([
      { type: 'TEXT', text: '본문' },
      { type: 'IMAGE', imageId: 501, alt: '이미지 설명' },
    ])
    expect(editableAdminPost('HIDDEN_REVIEW')).toBe(true)
    expect(editableAdminPost('PUBLISHED')).toBe(false)
    expect(adminPostStatusLabel('REMOVED')).toBe('최종 삭제')
  })

  it('검색 query를 검증하고 trim·encoding한 Core query로 만든다', () => {
    expect(validateAdminPostSearch({
      status: 'DRAFT',
      board: 'meme',
      titlePrefix: '  제목 %  ',
      page: '2',
    })).toEqual({
      ok: true,
      queryString: 'status=DRAFT&board=meme&titlePrefix=%EC%A0%9C%EB%AA%A9+%25&page=2',
    })
    expect(validateAdminPostSearch({ status: ['DRAFT', 'PUBLISHED'] }))
      .toEqual({ ok: false, field: 'status', reason: 'singleValueRequired' })
    expect(validateAdminPostSearch({ from: '2026-08-18T00:00:00Z', to: '2026-08-17T00:00:00Z' }))
      .toEqual({ ok: false, field: 'to', reason: 'beforeFrom' })
  })

  it('관리자 목록 응답에서 계약 필드만 남긴다', () => {
    const mapped = mapAdminPostsResponse({
      success: true,
      data: {
        items: [{
          postId: 1044,
          boardSlug: 'meme',
          title: '초안 글',
          status: 'DRAFT',
          lockVersion: 1,
          scheduledAt: null,
          publishedAt: null,
          updatedAt: '2026-08-17T00:00:00.000Z',
          internalSql: 'private',
        }],
        storageKey: 'private/key',
      },
      meta: {
        requestId: 'request-id',
        page: 1,
        pageSize: 50,
        totalItems: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
        sqlDurationMs: 3,
      },
    })
    expect(mapped.data.items[0]).not.toHaveProperty('internalSql')
    expect(mapped.data).not.toHaveProperty('storageKey')
    expect(mapped.meta).not.toHaveProperty('sqlDurationMs')
  })

  it('초안 생성·수정 body와 멱등키를 BFF 경계에서 검증한다', () => {
    expect(validateIdempotencyKey('draft-create-0001').ok).toBe(true)
    expect(validateIdempotencyKey('공백 key')).toEqual({
      ok: false,
      field: 'Idempotency-Key',
      reason: 'requiredOrInvalid',
    })
    expect(validateAdminPostCreate({
      boardSlug: 'meme',
      title: '  제목  ',
      source: null,
      blocks: [{ type: 'TEXT', text: '<tag> 문자열' }],
    })).toEqual({
      ok: true,
      value: {
        boardSlug: 'meme',
        title: '제목',
        source: null,
        blocks: [{ type: 'TEXT', text: '<tag> 문자열' }],
        pinnedPosition: null,
      },
    })
    expect(validateAdminPostUpdate({ lockVersion: 1, blocks: [] })).toEqual({
      ok: false,
      field: 'blocks',
      reason: 'arrayLength',
    })
  })

  it('발행·예약·취소·숨김·재공개·최종 삭제 command를 BFF 경계에서 검증한다', () => {
    const now = new Date('2026-08-17T00:00:00.000Z')
    expect(validateAdminPostPublish({ lockVersion: 1, mode: 'IMMEDIATE' }, now)).toEqual({
      ok: true,
      value: { lockVersion: 1, mode: 'IMMEDIATE' },
    })
    expect(validateAdminPostPublish({
      lockVersion: 1,
      mode: 'SCHEDULED',
      scheduledAt: '2026-08-17T00:02:00+00:00',
    }, now)).toEqual({
      ok: true,
      value: {
        lockVersion: 1,
        mode: 'SCHEDULED',
        scheduledAt: '2026-08-17T00:02:00.000Z',
      },
    })
    expect(validateAdminPostPublish({
      lockVersion: 1,
      mode: 'SCHEDULED',
      scheduledAt: '2026-08-17T00:00:30.000Z',
    }, now)).toMatchObject({ ok: false, field: 'scheduledAt', reason: 'minimumLeadTime' })
    expect(validateAdminPostUnschedule({ lockVersion: 2 })).toEqual({
      ok: true,
      value: { lockVersion: 2 },
    })
    expect(validateAdminPostHide({ lockVersion: 3, reasonCode: 'MANUAL' })).toEqual({
      ok: false,
      field: 'reasonCode',
      reason: 'unsupportedValue',
    })
    expect(validateAdminPostRepublish({ lockVersion: 4, pinnedPosition: null })).toEqual({
      ok: true,
      value: { lockVersion: 4, pinnedPosition: null },
    })
    expect(validateAdminPostRepublish({ lockVersion: 4, pinnedPosition: 4 })).toEqual({
      ok: false,
      field: 'pinnedPosition',
      reason: 'integerRange',
    })
    expect(validateAdminPostRemove({ lockVersion: 5, reasonCode: 'RIGHTS_EMAIL' })).toEqual({
      ok: true,
      value: { lockVersion: 5, reasonCode: 'RIGHTS_EMAIL' },
    })
  })

  it('관리자 상세 IMAGE를 편집 계약으로 제한하고 storage key를 제거한다', () => {
    const mapped = mapAdminPostDetailResponse({
      success: true,
      data: {
        postId: 1047,
        boardSlug: 'meme',
        title: '제목',
        source: null,
        blocks: [{
          type: 'IMAGE',
          image: {
            imageId: 501,
            status: 'PUBLIC',
            alt: '이미지',
            width: 1200,
            height: 900,
            previewPath: '/api/v1/admin/images/501/preview',
            privateStorageKey: 'private/key',
          },
        }],
        pinnedPosition: null,
        status: 'PUBLISHED',
        scheduledAt: null,
        publishedAt: '2026-08-17T00:00:00.000Z',
        lockVersion: 1,
        createdAt: '2026-08-16T00:00:00.000Z',
        updatedAt: '2026-08-17T00:00:00.000Z',
      },
      meta: { requestId: 'request-id' },
    })
    expect(mapped.data.blocks[0]).toEqual({
      type: 'IMAGE',
      image: {
        imageId: 501,
        status: 'PUBLIC',
        alt: '이미지',
        width: 1200,
        height: 900,
        previewPath: '/api/v1/admin/images/501/preview',
      },
    })
  })

  it('Core 요청에는 내부 서비스 토큰과 HMAC actor만 전달한다', async () => {
    const raw = vi.fn(async (_path: string, options: Record<string, unknown>) => ({
      status: 200,
      _data: { success: true, data: { items: [] }, meta: { requestId: 'request-id' } },
      options,
    }))
    vi.stubGlobal('$fetch', { raw })
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: 'http://core.test',
      coreApiTimeoutMs: 3000,
      coreServiceToken: 'service-token-with-at-least-thirty-two-bytes',
      adminActorHmacSecret: 'actor-secret-with-at-least-thirty-two-bytes',
    }))
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())

    const event = { context: { adminPrincipal: { operatorId: 'operator-1' } } } as unknown as H3Event
    await proxyAdminGet(event, {
      path: '/internal/v1/admin/posts?page=1',
      mapSuccess: (value) => value as { meta: { requestId: string } },
    })

    expect(raw).toHaveBeenCalledOnce()
    const options = raw.mock.calls[0][1] as { headers: Record<string, string> }
    expect(options.headers['X-Blariyo-Service-Token'])
      .toBe('service-token-with-at-least-thirty-two-bytes')
    expect(options.headers['X-Blariyo-Admin-Actor']).toMatch(/^admin:v1:[A-Za-z0-9_-]{43}$/)
    expect(JSON.stringify(options.headers)).not.toContain('operator-1')
    expect(JSON.stringify(options.headers)).not.toContain('cf-access')
  })

  it('초안 생성은 정규화한 JSON과 멱등키만 Core에 전달한다', async () => {
    const raw = vi.fn(async (_path: string, options: Record<string, unknown>) => ({
      status: 201,
      _data: {
        success: true,
        data: { postId: 1050, status: 'DRAFT', lockVersion: 1, storageKey: 'private' },
        meta: { requestId: 'request-id' },
      },
      options,
    }))
    vi.stubGlobal('$fetch', { raw })
    vi.stubGlobal('useRuntimeConfig', () => ({
      coreApiBaseUrl: 'http://core.test',
      coreApiTimeoutMs: 3000,
      coreServiceToken: 'service-token-with-at-least-thirty-two-bytes',
      adminActorHmacSecret: 'actor-secret-with-at-least-thirty-two-bytes',
    }))
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())
    const event = { context: { adminPrincipal: { operatorId: 'operator-1' } } } as unknown as H3Event

    const result = await proxyAdminJson(event, {
      path: '/internal/v1/admin/posts',
      method: 'POST',
      body: { boardSlug: 'meme', title: '제목', blocks: [{ type: 'TEXT', text: '본문' }] },
      headers: { 'Idempotency-Key': 'draft-create-0001' },
      mapSuccess: mapAdminPostCreatedResponse,
    }) as ReturnType<typeof mapAdminPostCreatedResponse>

    expect(result.data).toEqual({ postId: 1050, status: 'DRAFT', lockVersion: 1 })
    const options = raw.mock.calls[0][1] as {
      method: string
      body: unknown
      headers: Record<string, string>
    }
    expect(options.method).toBe('POST')
    expect(options.headers['Idempotency-Key']).toBe('draft-create-0001')
    expect(options.body).toEqual({
      boardSlug: 'meme',
      title: '제목',
      blocks: [{ type: 'TEXT', text: '본문' }],
    })
  })
})
