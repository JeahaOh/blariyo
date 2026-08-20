const { Pool } = require('pg');
const request = require('supertest');
const createApp = require('../src/core/createApp');
const { migrate } = require('../src/db/migrate');
const { aggregateEventBatch, deleteExpiredRawEvents } = require('../src/jobs/aggregateEventBatch');
const OutboxRepository = require('../src/core/repositories/outboxRepository');
const OutboxProcessor = require('../src/jobs/processOutboxBatch');
const AdminPostLifecycleRepository = require('../src/core/repositories/adminPostLifecycleRepository');
const MediaPromotionService = require('../src/core/services/mediaPromotionService');
const ScheduledPostPublisher = require('../src/jobs/publishScheduledPosts');
const { seedPublicContent } = require('./fixtures/publicContentFixture');

const EVENT_HMAC_SECRET = 'test-event-hmac-secret-with-at-least-32-bytes';
const CORE_SERVICE_TOKEN = 'test-core-service-token-with-at-least-32-bytes';
const ADMIN_ACTOR = `admin:v1:${'a'.repeat(43)}`;
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const privateObjects = new Map();
const publicObjects = new Map();
const purgedPaths = [];
const privateMediaStorage = {
  put: async (key, body) => privateObjects.set(key, Buffer.from(body)),
  get: async (key) => {
    const body = privateObjects.get(key);
    if (!body) throw new Error('Object not found');
    return Buffer.from(body);
  },
  delete: async (key) => privateObjects.delete(key),
};
const publicMediaStorage = {
  put: async (key, body) => publicObjects.set(key, Buffer.from(body)),
  delete: async (key) => publicObjects.delete(key),
};
const cachePurge = {
  purge: async (paths) => purgedPaths.push(...paths),
};

const describeIntegration = process.env.RUN_PUBLIC_API_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('public content Core API', () => {
  let pool;
  let app;

  beforeAll(async () => {
    process.env.MIGRATION_DB_HOST = process.env.MIGRATION_DB_HOST || '127.0.0.1';
    process.env.MIGRATION_DB_PORT = process.env.MIGRATION_DB_PORT || '45434';
    process.env.MIGRATION_DB_NAME = process.env.MIGRATION_DB_NAME || 'blariyo_migration_test';
    process.env.MIGRATION_DB_USER = process.env.MIGRATION_DB_USER || 'blariyo_migration_test';
    process.env.MIGRATION_DB_PASSWORD =
      process.env.MIGRATION_DB_PASSWORD || 'blariyo_migration_test';

    await migrate();
    pool = new Pool({
      host: process.env.MIGRATION_DB_HOST,
      port: Number(process.env.MIGRATION_DB_PORT),
      database: process.env.MIGRATION_DB_NAME,
      user: process.env.MIGRATION_DB_USER,
      password: process.env.MIGRATION_DB_PASSWORD,
      max: 5,
    });
    app = createApp({
      pool,
      mediaBaseUrl: 'https://img.test.local',
      serviceBaseUrl: 'https://test.local',
      eventHmacSecret: EVENT_HMAC_SECRET,
      coreServiceToken: CORE_SERVICE_TOKEN,
      privateMediaStorage,
      publicMediaStorage,
    });
    await seedPublicContent(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE analytics.raw_event, analytics.daily_event_metric');
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('Core readiness에서 migration version을 확인한다', async () => {
    await request(app)
      .get('/internal/health/ready')
      .expect('Cache-Control', 'no-store')
      .expect(200, { status: 'READY' });
  });

  it('기대 migration version과 다르면 ready를 거부한다', async () => {
    const notReadyApp = createApp({
      pool,
      expectedMigrationVersion: 3,
      eventHmacSecret: EVENT_HMAC_SECRET,
      coreServiceToken: CORE_SERVICE_TOKEN,
    });
    await request(notReadyApp)
      .get('/internal/health/ready')
      .expect('Cache-Control', 'no-store')
      .expect(503, { status: 'NOT_READY' });
  });

  it('활성 게시판만 반환한다', async () => {
    const response = await request(app).get('/internal/v1/boards').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([
      { slug: 'meme', displayName: '짤', postingPolicy: 'ADMIN', path: '/meme' },
      { slug: 'empty', displayName: '빈 게시판', postingPolicy: 'ADMIN', path: '/empty' },
      { slug: 'other', displayName: '다른 게시판', postingPolicy: 'ADMIN', path: '/other' },
    ]);
    expect(response.body.meta.requestId).toBe(response.headers['x-request-id']);
  });

  it('게시판 nested 목록에서 공지와 일반 글을 분리한다', async () => {
    const response = await request(app)
      .get('/internal/v1/boards/meme/posts?page=1')
      .expect('Cache-Control', 'public, max-age=60')
      .expect(200);

    expect(response.body.data.board).toEqual({ slug: 'meme', displayName: '짤' });
    expect(response.body.data.pinnedItems.map((item) => item.postId)).toEqual([12]);
    expect(response.body.data.items.map((item) => item.postId)).toEqual([1047, 1046]);
    expect(response.body.data.items[0].path).toBe('/meme/posts/1047');
    expect(response.body.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it('게시글이 없는 활성 게시판 page 1은 빈 목록이다', async () => {
    const response = await request(app).get('/internal/v1/boards/empty/posts').expect(200);

    expect(response.body.data.pinnedItems).toEqual([]);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.meta).toMatchObject({ page: 1, totalItems: 0, totalPages: 0 });
  });

  it('목록의 미존재 게시판과 초과 page를 구분한다', async () => {
    await expectError(
      request(app).get('/internal/v1/boards/missing/posts'),
      404,
      'BOARD_NOT_FOUND'
    );
    await expectError(
      request(app).get('/internal/v1/boards/inactive/posts'),
      404,
      'BOARD_NOT_FOUND'
    );
    await expectError(
      request(app).get('/internal/v1/boards/INVALID/posts'),
      404,
      'BOARD_NOT_FOUND'
    );
    await expectError(
      request(app).get('/internal/v1/boards/meme/posts?page=2'),
      404,
      'PAGE_NOT_FOUND'
    );
    await expectError(
      request(app).get('/internal/v1/boards/meme/posts?page=0'),
      400,
      'VALIDATION_FAILED',
      [{ field: 'page', reason: 'integerRange' }]
    );
  });

  it('게시판 소속을 검증한 상세와 현재 목록 context를 반환한다', async () => {
    const response = await request(app)
      .get('/internal/v1/boards/meme/posts/1047')
      .expect('Cache-Control', 'public, max-age=300')
      .expect(200);

    expect(response.body.data.post).toMatchObject({
      postId: 1047,
      board: { slug: 'meme', displayName: '짤' },
      title: '공개 일반 글 1047',
      authorLabel: '운영자',
      viewCount: 1248,
      source: { name: 'example.com', url: 'https://example.com/source/1047' },
      shareUrl: 'https://test.local/meme/posts/1047',
    });
    expect(response.body.data.post.blocks).toEqual([
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
    ]);
    expect(response.body.data.context.listPage).toBe(1);
    expect(response.body.data.context.items.find((item) => item.postId === 1047).current).toBe(
      true
    );
  });

  it('게시판 불일치·비공개·잘못된 식별자를 같은 상세 404로 반환한다', async () => {
    const paths = [
      '/internal/v1/boards/other/posts/1047',
      '/internal/v1/boards/meme/posts/1045',
      '/internal/v1/boards/meme/posts/1043',
      '/internal/v1/boards/meme/posts/1042',
      '/internal/v1/boards/meme/posts/not-a-number',
      '/internal/v1/boards/MEME/posts/1047',
    ];
    for (const path of paths) {
      await expectError(request(app).get(path), 404, 'POST_NOT_FOUND');
    }
  });

  it('현재·과거 정책과 공개 이력만 반환한다', async () => {
    const current = await request(app)
      .get('/internal/v1/policies/privacy')
      .expect('Cache-Control', 'public, max-age=60, s-maxage=300')
      .expect(200);

    expect(current.body.data.policy).toEqual({
      type: 'privacy',
      version: 'v0.2',
      title: '개인정보처리방침',
      bodyHtml: '<h2>현재 개인정보처리방침</h2><p>테스트 본문</p>',
      effectiveAt: '2026-08-01T00:00:00.000Z',
      endedAt: null,
    });
    expect(current.body.data.history.map((item) => item.version)).toEqual(['v0.2', 'v0.1']);

    const previous = await request(app)
      .get('/internal/v1/policies/privacy?version=v0.1')
      .expect(200);
    expect(previous.body.data.policy).toMatchObject({
      type: 'privacy',
      version: 'v0.1',
      endedAt: '2026-07-31T23:59:59.999Z',
    });
  });

  it('정책 초안·예약본·잘못된 유형과 version은 같은 404다', async () => {
    for (const path of [
      '/internal/v1/policies/terms',
      '/internal/v1/policies/privacy?version=v0.3',
      '/internal/v1/policies/privacy?version=draft',
      '/internal/v1/policies/unknown',
    ]) {
      await expectError(request(app).get(path), 404, 'POLICY_NOT_FOUND');
    }
  });

  it('이벤트 식별자를 HMAC으로 저장하고 10초 중복 요청을 합친다', async () => {
    const payload = eventPayload({ eventType: 'FEED_VIEW', listPage: 1, itemCount: 2 });

    await request(app).post('/internal/v1/events').send(payload).expect('Cache-Control', 'no-store').expect(204);
    await request(app).post('/internal/v1/events').send(payload).expect(204);

    const stored = await pool.query(
      `SELECT type, anonymous_hmac, session_hmac, dedupe_hmac, list_page, item_count
       FROM analytics.raw_event`
    );
    expect(stored.rowCount).toBe(1);
    expect(stored.rows[0]).toMatchObject({ type: 'FEED_VIEW', list_page: 1, item_count: 2 });
    expect(stored.rows[0].anonymous_hmac).toHaveLength(32);
    expect(stored.rows[0].session_hmac).toHaveLength(32);
    expect(stored.rows[0].dedupe_hmac).toHaveLength(32);
    expect(stored.rows[0].anonymous_hmac.toString('utf8')).not.toContain(payload.anonymousId);
  });

  it('이벤트 field 조합과 공개 게시판·게시글 소속을 검증한다', async () => {
    await expectError(
      request(app).post('/internal/v1/events').set('Content-Type', 'application/json').send('{'),
      400,
      'VALIDATION_FAILED',
      [{ field: 'body', reason: 'invalidJson' }]
    );
    await expectError(
      request(app).post('/internal/v1/events').send(eventPayload({ eventType: 'POST_VIEW' })),
      400,
      'VALIDATION_FAILED',
      [{ field: 'postId', reason: 'required' }]
    );
    await expectError(
      request(app).post('/internal/v1/events').send(
        eventPayload({ eventType: 'POST_VIEW', postId: 1047, listPage: 1 })
      ),
      400,
      'VALIDATION_FAILED',
      [{ field: 'listPage', reason: 'notAllowed' }]
    );
    await expectError(
      request(app).post('/internal/v1/events').send(
        eventPayload({ eventType: 'FEED_VIEW', boardSlug: 'missing', listPage: 1, itemCount: 0 })
      ),
      404,
      'BOARD_NOT_FOUND'
    );
    await expectError(
      request(app).post('/internal/v1/events').send(
        eventPayload({ eventType: 'POST_VIEW', postId: 1045 })
      ),
      404,
      'POST_NOT_FOUND'
    );
  });

  it('이벤트를 여러 batch로 집계해도 일별 순 사용자와 조회수를 중복 반영하지 않는다', async () => {
    const initialViewCount = await pool.query('SELECT view_count FROM content.board_post WHERE id = 1047');
    const anonymousIds = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ];
    for (let index = 0; index < anonymousIds.length; index += 1) {
      await request(app)
        .post('/internal/v1/events')
        .send(eventPayload({
          eventType: 'POST_VIEW',
          postId: 1047,
          anonymousId: anonymousIds[index],
          sessionId: `session0${index + 1}-cccc-4ccc-8ccc-cccccccccccc`,
        }))
        .expect(204);
    }

    const first = await aggregateEventBatch(pool, { batchSize: 1 });
    const second = await aggregateEventBatch(pool, { batchSize: 1 });
    const third = await aggregateEventBatch(pool, { batchSize: 10 });
    const empty = await aggregateEventBatch(pool, { batchSize: 10 });
    expect(first.processed).toBe(1);
    expect(second.processed).toBe(1);
    expect(third.processed).toBe(1);
    expect(empty.processed).toBe(0);

    const metric = await pool.query(
      `SELECT event_count, unique_anonymous_count
       FROM analytics.daily_event_metric
       WHERE event_type = 'POST_VIEW'`
    );
    expect(metric.rows).toEqual([{ event_count: '3', unique_anonymous_count: '2' }]);

    const currentViewCount = await pool.query('SELECT view_count FROM content.board_post WHERE id = 1047');
    expect(Number(currentViewCount.rows[0].view_count)).toBe(Number(initialViewCount.rows[0].view_count) + 3);
  });

  it('90일이 지난 집계 완료 raw 이벤트만 삭제하고 일별 집계는 보존한다', async () => {
    await request(app)
      .post('/internal/v1/events')
      .send(eventPayload({ eventType: 'POST_VIEW', postId: 1047 }))
      .expect(204);
    const aggregated = await aggregateEventBatch(pool);
    expect(aggregated.processed).toBe(1);

    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    const oldest = await pool.query(
      `UPDATE analytics.raw_event
       SET occurred_at = $1
       WHERE id = (SELECT MIN(id) FROM analytics.raw_event)
       RETURNING id`,
      [oldDate]
    );
    expect(oldest.rowCount).toBe(1);

    const deleted = await deleteExpiredRawEvents(pool);
    expect(deleted).toBe(1);
    const remainingRaw = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM analytics.raw_event');
    expect(remainingRaw.rows[0].count).toBe(0);
    const remainingDaily = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM analytics.daily_event_metric');
    expect(remainingDaily.rows[0].count).toBeGreaterThan(0);
  });

  it('게시판 문맥 없는 Core route를 제공하지 않는다', async () => {
    await expectError(request(app).get('/internal/v1/posts/1047'), 404, 'ROUTE_NOT_FOUND');
  });

  it('관리자 게시글을 상태·게시판·제목 prefix로 검색하고 고정 pagination을 반환한다', async () => {
    const draft = await adminRequest(request(app).get('/internal/v1/admin/posts?status=DRAFT&page=1'))
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(draft.body.data.items).toHaveLength(1);
    expect(draft.body.data.items[0]).toMatchObject({
      postId: 1044,
      boardSlug: 'meme',
      title: '초안 글',
      status: 'DRAFT',
      lockVersion: 1,
      scheduledAt: null,
      publishedAt: null,
    });
    expect(draft.body.meta).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 1,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });

    const prefix = await adminRequest(
      request(app).get('/internal/v1/admin/posts?board=meme&titlePrefix=%EA%B3%B5%EA%B0%9C')
    ).expect(200);
    expect(prefix.body.data.items.map((item) => item.postId)).toEqual([1047, 1046]);

    const literalWildcard = await adminRequest(
      request(app).get('/internal/v1/admin/posts?titlePrefix=%25')
    ).expect(200);
    expect(literalWildcard.body.data.items).toEqual([]);
    expect(literalWildcard.body.meta.totalItems).toBe(0);
  });

  it('관리자 게시글 검색 query의 형식·단일값·기간 순서를 검증한다', async () => {
    for (const [path, field, reason] of [
      ['/internal/v1/admin/posts?status=UNKNOWN', 'status', 'unsupportedValue'],
      ['/internal/v1/admin/posts?status=DRAFT&status=PUBLISHED', 'status', 'singleValueRequired'],
      ['/internal/v1/admin/posts?board=INVALID', 'board', 'invalidFormat'],
      ['/internal/v1/admin/posts?titlePrefix=%20%20', 'titlePrefix', 'length'],
      ['/internal/v1/admin/posts?from=not-a-date', 'from', 'dateTime'],
      ['/internal/v1/admin/posts?from=2026-08-18T00:00:00Z&to=2026-08-17T00:00:00Z', 'to', 'beforeFrom'],
      ['/internal/v1/admin/posts?page=0', 'page', 'integerRange'],
      ['/internal/v1/admin/posts?unknown=value', 'unknown', 'notAllowed'],
    ]) {
      await expectError(adminRequest(request(app).get(path)), 400, 'VALIDATION_FAILED', [
        { field, reason },
      ]);
    }
  });

  it('관리자 게시글 상세는 비공개 상태와 편집 block을 반환하되 storage key는 숨긴다', async () => {
    const response = await adminRequest(request(app).get('/internal/v1/admin/posts/1047'))
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(response.body.data).toMatchObject({
      postId: 1047,
      boardSlug: 'meme',
      title: '공개 일반 글 1047',
      source: { name: 'example.com', url: 'https://example.com/source/1047' },
      pinnedPosition: null,
      status: 'PUBLISHED',
      lockVersion: 1,
    });
    expect(response.body.data.blocks).toEqual([
      { type: 'TEXT', text: '본문 텍스트' },
      {
        type: 'IMAGE',
        image: {
          imageId: 501,
          status: 'PUBLIC',
          alt: '테스트 이미지',
          width: 1200,
          height: 900,
          previewPath: '/api/v1/admin/images/501/preview',
        },
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain('storage');

    const draft = await adminRequest(request(app).get('/internal/v1/admin/posts/1044')).expect(200);
    expect(draft.body.data).toMatchObject({ postId: 1044, status: 'DRAFT', blocks: [] });
  });

  it('관리자 게시글 상세의 잘못된 식별자와 미존재 글은 같은 404다', async () => {
    for (const path of ['/internal/v1/admin/posts/not-a-number', '/internal/v1/admin/posts/999999']) {
      await expectError(adminRequest(request(app).get(path)), 404, 'POST_NOT_FOUND');
    }
  });

  it('이미지 staging부터 초안 선점·멱등 생성·낙관적 수정·폐기를 한 흐름으로 처리한다', async () => {
    const upload = await adminRequest(
      request(app)
        .post('/internal/v1/admin/images')
        .attach('files', TEST_PNG, { filename: 'pixel.png', contentType: 'image/png' })
    ).expect('Cache-Control', 'private, no-store').expect(201);
    const image = upload.body.data.items[0];
    expect(image).toMatchObject({
      status: 'STAGED',
      mimeType: 'image/png',
      width: 1,
      height: 1,
    });
    expect(JSON.stringify(upload.body)).not.toContain('storage');

    const preview = await adminRequest(
      request(app).get(`/internal/v1/admin/images/${image.imageId}/preview`)
    ).expect('Cache-Control', 'private, no-store').expect('Content-Type', 'image/png').expect(200);
    expect(preview.body).toEqual(TEST_PNG);

    const idempotencyKey = `draft-flow-${Date.now()}`;
    const createBody = {
      boardSlug: 'meme',
      title: '  새 초안  ',
      source: null,
      blocks: [
        { type: 'TEXT', text: '<tag> 문자열 본문' },
        { type: 'IMAGE', imageId: image.imageId, alt: ' 픽셀 이미지 ' },
      ],
      pinnedPosition: null,
    };
    const created = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', idempotencyKey)
      .send(createBody)
      .expect(201);
    const postId = created.body.data.postId;
    expect(created.body.data).toEqual({ postId, status: 'DRAFT', lockVersion: 1 });

    const replayed = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', idempotencyKey)
      .send(createBody)
      .expect(201);
    expect(replayed.body.data).toEqual(created.body.data);
    await expectError(
      adminRequest(request(app).post('/internal/v1/admin/posts'))
        .set('Idempotency-Key', idempotencyKey)
        .send({ ...createBody, title: '다른 요청' }),
      409,
      'IDEMPOTENCY_CONFLICT'
    );

    const claimed = await pool.query(
      'SELECT post_id, status FROM content.board_post_image WHERE id = $1',
      [image.imageId]
    );
    expect(claimed.rows[0]).toEqual({ post_id: String(postId), status: 'STAGED' });

    const updated = await adminRequest(request(app).patch(`/internal/v1/admin/posts/${postId}`))
      .send({ lockVersion: 1, title: '수정 초안', blocks: [{ type: 'TEXT', text: '수정 본문' }] })
      .expect(200);
    expect(updated.body.data).toMatchObject({ postId, status: 'DRAFT', lockVersion: 2 });
    await expectError(
      adminRequest(request(app).patch(`/internal/v1/admin/posts/${postId}`))
        .send({ lockVersion: 1, title: '뒤늦은 수정' }),
      409,
      'POST_VERSION_CONFLICT'
    );

    const released = await pool.query(
      'SELECT post_id, status FROM content.board_post_image WHERE id = $1',
      [image.imageId]
    );
    expect(released.rows[0]).toEqual({ post_id: null, status: 'STAGED' });
    const discarded = await adminRequest(
      request(app).delete(`/internal/v1/admin/images/${image.imageId}`)
    ).expect(202);
    expect(discarded.body.data).toEqual({
      imageId: image.imageId,
      status: 'PRIVATE_DELETE_PENDING',
    });
    const outbox = await pool.query(
      `SELECT type, status FROM ops.outbox_task
       WHERE aggregate_type = 'IMAGE' AND aggregate_id = $1`,
      [image.imageId]
    );
    expect(outbox.rows).toEqual([{ type: 'OBJECT_DELETE_PRIVATE', status: 'PENDING' }]);

    const outboxResult = await createOutboxProcessor(pool).processBatch();
    expect(outboxResult).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    const deletedImage = await pool.query(
      'SELECT status FROM content.board_post_image WHERE id = $1',
      [image.imageId]
    );
    expect(deletedImage.rows[0].status).toBe('DELETED');

    await pool.query('DELETE FROM ops.idempotency_request WHERE resource_id = $1', [postId]);
    await pool.query("DELETE FROM ops.outbox_task WHERE aggregate_type = 'IMAGE' AND aggregate_id = $1", [image.imageId]);
    await pool.query('DELETE FROM content.board_post_status_history WHERE post_id = $1', [postId]);
    await pool.query('DELETE FROM content.board_post_block WHERE post_id = $1', [postId]);
    await pool.query('DELETE FROM content.board_post WHERE id = $1', [postId]);
    await pool.query('DELETE FROM content.board_post_image WHERE id = $1', [image.imageId]);
  });

  it('즉시 발행 후 공개하고 숨김 commit 직후 404와 public image 삭제 outbox를 처리한다', async () => {
    purgedPaths.length = 0;
    const upload = await adminRequest(
      request(app)
        .post('/internal/v1/admin/images')
        .attach('files', TEST_PNG, { filename: 'publish.png', contentType: 'image/png' })
    ).expect(201);
    const imageId = upload.body.data.items[0].imageId;
    const create = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', `publish-create-${Date.now()}`)
      .send({
        boardSlug: 'meme',
        title: '발행과 숨김 통합 글',
        blocks: [
          { type: 'TEXT', text: '공개 본문' },
          { type: 'IMAGE', imageId, alt: '공개 이미지' },
        ],
      })
      .expect(201);
    const postId = create.body.data.postId;
    const publishKey = `publish-now-${Date.now()}`;
    const published = await adminRequest(
      request(app).post(`/internal/v1/admin/posts/${postId}/publish`)
    )
      .set('Idempotency-Key', publishKey)
      .send({ lockVersion: 1, mode: 'IMMEDIATE' })
      .expect(200);
    expect(published.body.data).toMatchObject({
      postId,
      status: 'PUBLISHED',
      lockVersion: 2,
      scheduledAt: null,
    });
    expect(published.body.data.publishedAt).toBeTruthy();

    const replay = await adminRequest(
      request(app).post(`/internal/v1/admin/posts/${postId}/publish`)
    )
      .set('Idempotency-Key', publishKey)
      .send({ lockVersion: 1, mode: 'IMMEDIATE' })
      .expect(200);
    expect(replay.body.data).toEqual(published.body.data);
    const publicImage = await pool.query(
      'SELECT status, public_storage_key FROM content.board_post_image WHERE id = $1',
      [imageId]
    );
    expect(publicImage.rows[0].status).toBe('PUBLIC');
    expect(publicObjects.has(publicImage.rows[0].public_storage_key)).toBe(true);
    await request(app).get(`/internal/v1/boards/meme/posts/${postId}`).expect(200);

    const hidden = await adminRequest(
      request(app).post(`/internal/v1/admin/posts/${postId}/hide`)
    )
      .set('Idempotency-Key', `hide-${Date.now()}`)
      .send({ lockVersion: 2, reasonCode: 'RIGHTS_EMAIL' })
      .expect(200);
    expect(hidden.body.data).toMatchObject({
      postId,
      status: 'HIDDEN_REVIEW',
      lockVersion: 3,
    });
    await expectError(
      request(app).get(`/internal/v1/boards/meme/posts/${postId}`),
      404,
      'POST_NOT_FOUND'
    );
    await expectError(
      adminRequest(request(app).patch(`/internal/v1/admin/posts/${postId}`))
        .send({ lockVersion: 3, blocks: [{ type: 'TEXT', text: '삭제 중 수정' }] }),
      409,
      'IMAGE_STATE_CONFLICT'
    );
    const pending = await pool.query(
      'SELECT status, public_storage_key FROM content.board_post_image WHERE id = $1',
      [imageId]
    );
    expect(pending.rows[0].status).toBe('PUBLIC_DELETE_PENDING');

    const worker = await createOutboxProcessor(pool).processBatch({ limit: 10 });
    expect(worker).toMatchObject({ processed: 3, succeeded: 3, failed: 0 });
    const privateReview = await pool.query(
      'SELECT status, public_storage_key FROM content.board_post_image WHERE id = $1',
      [imageId]
    );
    expect(privateReview.rows[0]).toEqual({ status: 'PRIVATE_REVIEW', public_storage_key: null });
    expect(publicObjects.has(pending.rows[0].public_storage_key)).toBe(false);
    expect(purgedPaths).toEqual(expect.arrayContaining([
      '/meme',
      `/meme/posts/${postId}`,
    ]));

    await cleanupPost(pool, postId, [imageId]);
  });

  it('숨김 완료 후 재공개하고 최종 삭제의 private 원본을 30일 뒤 제거한다', async () => {
    const upload = await adminRequest(
      request(app)
        .post('/internal/v1/admin/images')
        .attach('files', TEST_PNG, { filename: 'republish.png', contentType: 'image/png' })
    ).expect(201);
    const imageId = upload.body.data.items[0].imageId;
    const storedImage = await pool.query(
      'SELECT private_storage_key FROM content.board_post_image WHERE id = $1',
      [imageId]
    );
    const privateStorageKey = storedImage.rows[0].private_storage_key;
    const create = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', `republish-create-${Date.now()}`)
      .send({
        boardSlug: 'meme',
        title: '재공개와 최종 삭제 통합 글',
        blocks: [
          { type: 'TEXT', text: '복구 검토 본문' },
          { type: 'IMAGE', imageId, alt: '복구 검토 이미지' },
        ],
      })
      .expect(201);
    const postId = create.body.data.postId;

    try {
      const published = await adminRequest(
        request(app).post(`/internal/v1/admin/posts/${postId}/publish`)
      )
        .set('Idempotency-Key', `republish-publish-${Date.now()}`)
        .send({ lockVersion: 1, mode: 'IMMEDIATE' })
        .expect(200);
      const firstPublishedAt = published.body.data.publishedAt;

      await adminRequest(request(app).post(`/internal/v1/admin/posts/${postId}/hide`))
        .set('Idempotency-Key', `republish-hide-${Date.now()}`)
        .send({ lockVersion: 2, reasonCode: 'RIGHTS_EMAIL' })
        .expect(200);
      await expectError(
        adminRequest(request(app).post(`/internal/v1/admin/posts/${postId}/republish`))
          .set('Idempotency-Key', `republish-too-early-${Date.now()}`)
          .send({ lockVersion: 3, pinnedPosition: null }),
        409,
        'IMAGE_STATE_CONFLICT'
      );
      await expectError(
        adminRequest(request(app).delete(`/internal/v1/admin/posts/${postId}`))
          .set('Idempotency-Key', `remove-too-early-${Date.now()}`)
          .send({ lockVersion: 3, reasonCode: 'RIGHTS_EMAIL' }),
        409,
        'IMAGE_STATE_CONFLICT'
      );
      await createOutboxProcessor(pool).processBatch({ limit: 10 });

      const republished = await adminRequest(
        request(app).post(`/internal/v1/admin/posts/${postId}/republish`)
      )
        .set('Idempotency-Key', `republish-${Date.now()}`)
        .send({ lockVersion: 3, pinnedPosition: null })
        .expect(200);
      expect(republished.body.data).toMatchObject({
        postId,
        status: 'PUBLISHED',
        lockVersion: 4,
      });
      const republishedPost = await pool.query(
        'SELECT published_at FROM content.board_post WHERE id = $1',
        [postId]
      );
      expect(republishedPost.rows[0].published_at.toISOString()).toBe(firstPublishedAt);
      const republishedImage = await pool.query(
        'SELECT status, public_storage_key FROM content.board_post_image WHERE id = $1',
        [imageId]
      );
      expect(republishedImage.rows[0].status).toBe('PUBLIC');
      expect(publicObjects.has(republishedImage.rows[0].public_storage_key)).toBe(true);
      await request(app).get(`/internal/v1/boards/meme/posts/${postId}`).expect(200);

      await adminRequest(request(app).post(`/internal/v1/admin/posts/${postId}/hide`))
        .set('Idempotency-Key', `remove-hide-${Date.now()}`)
        .send({ lockVersion: 4, reasonCode: 'RIGHTS_EMAIL' })
        .expect(200);
      await createOutboxProcessor(pool).processBatch({ limit: 10 });

      const removeKey = `remove-${Date.now()}`;
      const removed = await adminRequest(request(app).delete(`/internal/v1/admin/posts/${postId}`))
        .set('Idempotency-Key', removeKey)
        .send({ lockVersion: 5, reasonCode: 'RIGHTS_EMAIL' })
        .expect(200);
      expect(removed.body.data).toMatchObject({ postId, status: 'REMOVED', lockVersion: 6 });
      const replay = await adminRequest(request(app).delete(`/internal/v1/admin/posts/${postId}`))
        .set('Idempotency-Key', removeKey)
        .send({ lockVersion: 5, reasonCode: 'RIGHTS_EMAIL' })
        .expect(200);
      expect(replay.body.data).toEqual(removed.body.data);
      await expectError(
        request(app).get(`/internal/v1/boards/meme/posts/${postId}`),
        404,
        'POST_NOT_FOUND'
      );

      const pendingPrivate = await pool.query(
        `SELECT image.status, task.status AS task_status, task.next_attempt_at
         FROM content.board_post_image image
         JOIN ops.outbox_task task
           ON task.aggregate_type = 'IMAGE' AND task.aggregate_id = image.id
          AND task.type = 'OBJECT_DELETE_PRIVATE'
         WHERE image.id = $1`,
        [imageId]
      );
      expect(pendingPrivate.rows[0]).toMatchObject({
        status: 'PRIVATE_DELETE_PENDING',
        task_status: 'PENDING',
      });
      const deleteAt = pendingPrivate.rows[0].next_attempt_at;
      const immediate = await createOutboxProcessor(pool).processBatch({ limit: 10 });
      expect(immediate.succeeded).toBe(1);
      expect(privateObjects.has(privateStorageKey)).toBe(true);

      const future = new Date(deleteAt.getTime() + 1);
      const delayedWorker = new OutboxProcessor({
        outboxRepository: new OutboxRepository(pool),
        privateMediaStorage,
        publicMediaStorage,
        cachePurge,
        clock: () => future,
      });
      await expect(delayedWorker.processBatch({ limit: 10 })).resolves.toMatchObject({
        processed: 1,
        succeeded: 1,
        failed: 0,
      });
      const deletedImage = await pool.query(
        'SELECT status FROM content.board_post_image WHERE id = $1',
        [imageId]
      );
      expect(deletedImage.rows[0].status).toBe('DELETED');
      expect(privateObjects.has(privateStorageKey)).toBe(false);

      await expectError(
        adminRequest(request(app).post(`/internal/v1/admin/posts/${postId}/republish`))
          .set('Idempotency-Key', `terminal-republish-${Date.now()}`)
          .send({ lockVersion: 6, pinnedPosition: null }),
        409,
        'POST_STATE_CONFLICT'
      );
    } finally {
      await cleanupPost(pool, postId, [imageId]);
    }
  });

  it('같은 lifecycle 멱등키가 처리 중이면 기다리지 않고 Retry-After 충돌을 반환한다', async () => {
    const upload = await adminRequest(
      request(app)
        .post('/internal/v1/admin/images')
        .attach('files', TEST_PNG, { filename: 'concurrent.png', contentType: 'image/png' })
    ).expect(201);
    const imageId = upload.body.data.items[0].imageId;
    const create = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', `concurrent-create-${Date.now()}`)
      .send({
        boardSlug: 'meme',
        title: '멱등 처리 중 글',
        blocks: [{ type: 'IMAGE', imageId, alt: '동시성 이미지' }],
      })
      .expect(201);
    const postId = create.body.data.postId;
    let releasePromotion;
    let notifyStarted;
    const promotionGate = new Promise((resolve) => { releasePromotion = resolve; });
    const promotionStarted = new Promise((resolve) => { notifyStarted = resolve; });
    const slowApp = createApp({
      pool,
      mediaBaseUrl: 'https://img.test.local',
      serviceBaseUrl: 'https://test.local',
      eventHmacSecret: EVENT_HMAC_SECRET,
      coreServiceToken: CORE_SERVICE_TOKEN,
      privateMediaStorage,
      publicMediaStorage: {
        put: async (key, body) => {
          notifyStarted();
          await promotionGate;
          publicObjects.set(key, Buffer.from(body));
        },
        delete: publicMediaStorage.delete,
      },
    });
    const key = `concurrent-publish-${Date.now()}`;
    const firstPromise = adminRequest(
      request(slowApp).post(`/internal/v1/admin/posts/${postId}/publish`)
    )
      .set('Idempotency-Key', key)
      .send({ lockVersion: 1, mode: 'IMMEDIATE' })
      .then((response) => response);
    await promotionStarted;
    const concurrent = await adminRequest(
      request(slowApp).post(`/internal/v1/admin/posts/${postId}/publish`)
    )
      .set('Idempotency-Key', key)
      .send({ lockVersion: 1, mode: 'IMMEDIATE' })
      .expect('Retry-After', '1')
      .expect(409);
    expect(concurrent.body.error.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    releasePromotion();
    const first = await firstPromise;
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('PUBLISHED');
    await cleanupPost(pool, postId, [imageId]);
  });

  it('예약·취소·재예약 후 due scheduler가 실제 공개 상태와 cache outbox를 만든다', async () => {
    purgedPaths.length = 0;
    const create = await adminRequest(request(app).post('/internal/v1/admin/posts'))
      .set('Idempotency-Key', `schedule-create-${Date.now()}`)
      .send({
        boardSlug: 'meme',
        title: '예약 발행 통합 글',
        blocks: [{ type: 'TEXT', text: '예약 본문' }],
      })
      .expect(201);
    const postId = create.body.data.postId;
    const firstScheduleAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const scheduled = await adminRequest(
      request(app).post(`/internal/v1/admin/posts/${postId}/publish`)
    )
      .set('Idempotency-Key', `schedule-${Date.now()}`)
      .send({ lockVersion: 1, mode: 'SCHEDULED', scheduledAt: firstScheduleAt })
      .expect(200);
    expect(scheduled.body.data).toEqual({
      postId,
      status: 'SCHEDULED',
      lockVersion: 2,
      publishedAt: null,
      scheduledAt: firstScheduleAt,
    });
    await expectError(
      request(app).get(`/internal/v1/boards/meme/posts/${postId}`),
      404,
      'POST_NOT_FOUND'
    );

    const unscheduled = await adminRequest(
      request(app).post(`/internal/v1/admin/posts/${postId}/unschedule`)
    )
      .set('Idempotency-Key', `unschedule-${Date.now()}`)
      .send({ lockVersion: 2 })
      .expect(200);
    expect(unscheduled.body.data).toMatchObject({
      postId,
      status: 'DRAFT',
      lockVersion: 3,
      scheduledAt: null,
    });

    const secondScheduleAt = new Date(Date.now() + 3 * 60 * 1000);
    await adminRequest(request(app).post(`/internal/v1/admin/posts/${postId}/publish`))
      .set('Idempotency-Key', `reschedule-${Date.now()}`)
      .send({ lockVersion: 3, mode: 'SCHEDULED', scheduledAt: secondScheduleAt.toISOString() })
      .expect(200);
    const dueNow = new Date();
    await pool.query(
      'UPDATE content.board_post SET scheduled_at = $2 WHERE id = $1',
      [postId, new Date(dueNow.getTime() - 1000)]
    );
    const publisher = new ScheduledPostPublisher({
      adminPostLifecycleRepository: new AdminPostLifecycleRepository(pool),
      mediaPromotionService: new MediaPromotionService({ privateMediaStorage, publicMediaStorage }),
      clock: () => dueNow,
    });
    await expect(publisher.publishDue()).resolves.toEqual({
      candidates: 1,
      published: 1,
      skipped: 0,
      failed: 0,
    });
    await request(app).get(`/internal/v1/boards/meme/posts/${postId}`).expect(200);
    const stored = await pool.query(
      'SELECT status, lock_version, scheduled_at, published_at FROM content.board_post WHERE id = $1',
      [postId]
    );
    expect(stored.rows[0]).toMatchObject({ status: 'PUBLISHED', lock_version: 5, scheduled_at: null });
    expect(stored.rows[0].published_at).toEqual(dueNow);

    const worker = await createOutboxProcessor(pool).processBatch();
    expect(worker).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
    await cleanupPost(pool, postId);
  });

  it('5분 넘은 RUNNING outbox를 회수하고 8회째 DEAD로 전환한다', async () => {
    const now = new Date();
    const inserted = await pool.query(
      `INSERT INTO ops.outbox_task (
         type, status, aggregate_type, aggregate_id, payload, attempt_count,
         next_attempt_at, last_error_code, created_by, created_at, updated_by, updated_at
       ) VALUES (
         'CACHE_PURGE', 'RUNNING', 'POST', 1047, '{"paths":["/meme"]}', 7,
         $1, NULL, $2, $3, 'system:outbox-worker', $3
       ) RETURNING id`,
      [now, ADMIN_ACTOR, new Date(now.getTime() - 6 * 60 * 1000)]
    );
    const repository = new OutboxRepository(pool);
    await expect(repository.recoverStale(now)).resolves.toBe(1);
    const task = await pool.query(
      'SELECT status, attempt_count, last_error_code FROM ops.outbox_task WHERE id = $1',
      [inserted.rows[0].id]
    );
    expect(task.rows[0]).toEqual({
      status: 'DEAD',
      attempt_count: 8,
      last_error_code: 'WORKER_STALE',
    });
    await pool.query('DELETE FROM ops.outbox_task WHERE id = $1', [inserted.rows[0].id]);
  });

  it('outbox 외부 작업 실패를 기록하고 지수 backoff 뒤 재시도 대상으로 둔다', async () => {
    const now = new Date();
    const inserted = await pool.query(
      `INSERT INTO ops.outbox_task (
         type, status, aggregate_type, aggregate_id, payload, attempt_count,
         next_attempt_at, created_by, created_at, updated_by, updated_at
       ) VALUES (
         'CACHE_PURGE', 'PENDING', 'POST', 1047, '{"paths":["/meme"]}', 0,
         $1, $2, $1, $2, $1
       ) RETURNING id`,
      [now, ADMIN_ACTOR]
    );
    const processor = new OutboxProcessor({
      outboxRepository: new OutboxRepository(pool),
      privateMediaStorage,
      publicMediaStorage,
      cachePurge: { purge: async () => { throw new Error('CACHE_PURGE_FAILED'); } },
      clock: () => now,
    });
    await expect(processor.processBatch({ limit: 1 })).resolves.toMatchObject({
      processed: 1,
      succeeded: 0,
      failed: 1,
    });
    const task = await pool.query(
      `SELECT status, attempt_count, last_error_code, next_attempt_at
       FROM ops.outbox_task WHERE id = $1`,
      [inserted.rows[0].id]
    );
    expect(task.rows[0]).toMatchObject({
      status: 'FAILED',
      attempt_count: 1,
      last_error_code: 'CACHE_PURGE_FAILED',
    });
    expect(task.rows[0].next_attempt_at).toEqual(new Date(now.getTime() + 1000));
    await pool.query('DELETE FROM ops.outbox_task WHERE id = $1', [inserted.rows[0].id]);
  });

  it('Core 관리자 경계는 내부 서비스 토큰과 provider-neutral actor를 검증한다', async () => {
    await expectError(
      request(app).get('/internal/v1/admin/not-implemented'),
      401,
      'CORE_SERVICE_AUTH_REQUIRED'
    );
    await expectError(
      request(app)
        .get('/internal/v1/admin/not-implemented')
        .set('X-Blariyo-Service-Token', 'wrong-service-token'),
      401,
      'CORE_SERVICE_AUTH_REQUIRED'
    );
    await expectError(
      request(app)
        .get('/internal/v1/admin/not-implemented')
        .set('X-Blariyo-Service-Token', CORE_SERVICE_TOKEN),
      401,
      'ADMIN_CONTEXT_REQUIRED'
    );
    await expectError(
      request(app)
        .get('/internal/v1/admin/not-implemented')
        .set('X-Blariyo-Service-Token', CORE_SERVICE_TOKEN)
        .set('X-Blariyo-Admin-Actor', ADMIN_ACTOR),
      404,
      'ROUTE_NOT_FOUND'
    );
  });

  it('회원 skeleton과 Swagger UI를 공개하지 않는다', async () => {
    for (const path of ['/api-docs', '/api/v1/users', '/api/v1/auth/login']) {
      await expectError(request(app).get(path), 404, 'ROUTE_NOT_FOUND');
    }
  });
});

async function expectError(requestBuilder, status, code, fields = []) {
  const response = await requestBuilder.expect('Cache-Control', 'no-store').expect(status);
  expect(response.body).toMatchObject({
    success: false,
    error: { code, fields },
  });
  expect(response.body.meta.requestId).toBe(response.headers['x-request-id']);
}

function eventPayload(overrides = {}) {
  return {
    eventType: 'FEED_VIEW',
    anonymousId: 'anonymous-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sessionId: 'session-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    boardSlug: 'meme',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

function adminRequest(requestBuilder) {
  return requestBuilder
    .set('X-Blariyo-Service-Token', CORE_SERVICE_TOKEN)
    .set('X-Blariyo-Admin-Actor', ADMIN_ACTOR);
}

function createOutboxProcessor(testPool) {
  return new OutboxProcessor({
    outboxRepository: new OutboxRepository(testPool),
    privateMediaStorage,
    publicMediaStorage,
    cachePurge,
  });
}

async function cleanupPost(testPool, postId, imageIds = []) {
  await testPool.query('DELETE FROM ops.idempotency_request WHERE resource_id = $1', [postId]);
  await testPool.query(
    `DELETE FROM ops.outbox_task
     WHERE (aggregate_type = 'POST' AND aggregate_id = $1)
        OR (aggregate_type = 'IMAGE' AND aggregate_id = ANY($2::BIGINT[]))`,
    [postId, imageIds]
  );
  await testPool.query('DELETE FROM content.board_post_status_history WHERE post_id = $1', [postId]);
  await testPool.query('DELETE FROM content.board_post_block WHERE post_id = $1', [postId]);
  if (imageIds.length > 0) {
    await testPool.query('DELETE FROM content.board_post_image WHERE id = ANY($1::BIGINT[])', [imageIds]);
  }
  await testPool.query('DELETE FROM content.board_post WHERE id = $1', [postId]);
}
