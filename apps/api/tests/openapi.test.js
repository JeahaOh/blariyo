const fs = require('fs');
const path = require('path');
const { validate } = require('@readme/openapi-parser');

const OPENAPI_PATH = path.resolve(__dirname, '../openapi/m0-bff.openapi.json');

describe('M0 BFF OpenAPI contract', () => {
  const specification = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8'));

  it('OpenAPI 3.1 schema validation을 통과한다', async () => {
    await expect(validate(OPENAPI_PATH)).resolves.toBeDefined();
  });

  it('OpenAPI 3.1 문서다', () => {
    expect(specification.openapi).toMatch(/^3\.1\./);
    expect(specification.info.title).toBe('Blariyo M0 BFF API');
  });

  it('health·공개 조회·정책·이벤트와 관리자 게시글 route를 모두 명세한다', () => {
    expect(Object.keys(specification.paths).sort()).toEqual(
      [
        '/health/live',
        '/health/ready',
        '/api/v1/boards',
        '/api/v1/boards/{boardSlug}/posts',
        '/api/v1/boards/{boardSlug}/posts/{postId}',
        '/api/v1/policies/{type}',
        '/api/v1/events',
        '/api/v1/admin/posts',
        '/api/v1/admin/posts/{postId}',
        '/api/v1/admin/images',
        '/api/v1/admin/images/{imageId}',
        '/api/v1/admin/images/{imageId}/preview',
        '/api/v1/admin/posts/{postId}/publish',
        '/api/v1/admin/posts/{postId}/unschedule',
        '/api/v1/admin/posts/{postId}/hide',
        '/api/v1/admin/posts/{postId}/republish',
      ].sort()
    );
    expect(specification.paths['/api/v1/posts']).toBeUndefined();
    expect(specification.paths['/api/v1/posts/{postId}']).toBeUndefined();
  });

  it('Nuxt의 모든 명시적 M0 BFF route와 OpenAPI method가 일치한다', () => {
    const implemented = [
      ...explicitNuxtRoutes(path.resolve(__dirname, '../../web/server/routes/health'), '/health'),
      ...explicitNuxtRoutes(path.resolve(__dirname, '../../web/server/api/v1'), '/api/v1'),
    ].sort();
    const documented = Object.entries(specification.paths).flatMap(([route, pathItem]) =>
      Object.keys(pathItem)
        .filter(method => ['get', 'post', 'patch', 'delete'].includes(method))
        .map(method => `${method.toUpperCase()} ${route}`)
    ).sort();
    expect(documented).toEqual(implemented);
  });

  it('M0 health의 정상·준비 미완료 응답을 명세한다', () => {
    expect(specification.paths['/health/live'].get.responses['200'].content['application/json'].schema)
      .toEqual({ $ref: '#/components/schemas/LivenessResponse' });
    expect(specification.paths['/health/ready'].get.responses['200'].content['application/json'].schema)
      .toEqual({ $ref: '#/components/schemas/ReadyResponse' });
    expect(specification.paths['/health/ready'].get.responses['503'].content['application/json'].schema)
      .toEqual({ $ref: '#/components/schemas/NotReadyResponse' });
  });

  it('관리자 인증과 멱등 command header를 외부 계약에 포함한다', () => {
    expect(specification.components.securitySchemes).toMatchObject({
      CloudflareAccessAssertion: {
        type: 'apiKey',
        in: 'header',
        name: 'CF-Access-Jwt-Assertion',
      },
      CloudflareAccessCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'CF_Authorization',
      },
    });
    const publish = specification.paths['/api/v1/admin/posts/{postId}/publish'].post;
    expect(publish.security).toEqual([
      { CloudflareAccessAssertion: [] },
      { CloudflareAccessCookie: [] },
    ]);
    expect(publish.parameters).toContainEqual({ $ref: '#/components/parameters/IdempotencyKey' });
  });

  it('관리자 편집 block·이미지 업로드·상태 전이 schema를 제한한다', () => {
    const blocks = specification.components.schemas.AdminPostBlocks;
    expect(blocks).toMatchObject({ minItems: 1, maxItems: 40 });
    expect(blocks.items.oneOf).toEqual([
      { $ref: '#/components/schemas/AdminTextBlockRequest' },
      { $ref: '#/components/schemas/AdminImageBlockRequest' },
    ]);
    const upload = specification.paths['/api/v1/admin/images'].post
      .requestBody.content['multipart/form-data'].schema.properties.files;
    expect(upload).toMatchObject({ type: 'array', minItems: 1, maxItems: 10 });
    expect(specification.components.schemas.AdminPostStatus.enum).toEqual([
      'DRAFT', 'SCHEDULED', 'PUBLISHED', 'HIDDEN_REVIEW', 'REMOVED',
    ]);
    expect(specification.components.schemas.AdminPostRepublishRequest.required)
      .toEqual(['lockVersion', 'pinnedPosition']);
  });

  it('boardSlug, postId와 page 제한을 계약에 포함한다', () => {
    expect(specification.components.parameters.BoardSlug.schema).toMatchObject({
      maxLength: 32,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    });
    expect(specification.components.parameters.PostId.schema).toMatchObject({
      type: 'integer',
      minimum: 1,
    });
    expect(specification.components.parameters.Page.schema).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 10000,
      default: 1,
    });
  });

  it('목록 크기와 상세 block union을 제한한다', () => {
    expect(specification.components.schemas.PostListData.properties.pinnedItems.maxItems).toBe(3);
    expect(specification.components.schemas.PostListData.properties.items.maxItems).toBe(20);
    const blockSchema =
      specification.components.schemas.PostDetailResponse.properties.data.properties.post.properties
        .blocks.items;
    expect(blockSchema.oneOf).toEqual([
      { $ref: '#/components/schemas/TextBlock' },
      { $ref: '#/components/schemas/ImageBlock' },
    ]);
  });

  it('정책 공개 상태와 이벤트별 field 조합을 계약에 포함한다', () => {
    const policy = specification.components.schemas.PolicyResponse;
    expect(policy.properties.data.properties.policy.additionalProperties).toBe(false);
    expect(policy.properties.data.properties.policy.required).toContain('bodyHtml');

    const event = specification.components.schemas.EventRequest;
    expect(event.oneOf).toEqual([
      { $ref: '#/components/schemas/FeedViewEvent' },
      { $ref: '#/components/schemas/PostViewEvent' },
      { $ref: '#/components/schemas/DetailListViewEvent' },
    ]);
    expect(specification.components.schemas.FeedViewEvent.properties).not.toHaveProperty('postId');
    expect(specification.components.schemas.PostViewEvent.properties).not.toHaveProperty('listPage');
    expect(specification.components.schemas.DetailListViewEvent.required).toEqual(
      expect.arrayContaining(['postId', 'listPage', 'itemCount'])
    );
  });
});

function explicitNuxtRoutes(root, prefix) {
  const routes = [];
  visit(root, []);
  return routes.sort();

  function visit(directory, segments) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        visit(path.join(directory, entry.name), [...segments, routeSegment(entry.name)]);
        continue;
      }
      const match = entry.name.match(/^(.+)\.(get|post|patch|delete)\.ts$/);
      if (!match) continue;
      const name = match[1];
      const method = match[2].toUpperCase();
      const parts = name === 'index' ? segments : [...segments, routeSegment(name)];
      routes.push(`${method} ${prefix}/${parts.filter(Boolean).join('/')}`);
    }
  }
}

function routeSegment(value) {
  const match = value.match(/^\[([^\.][^\]]*)\]$/);
  return match ? `{${match[1]}}` : value;
}
