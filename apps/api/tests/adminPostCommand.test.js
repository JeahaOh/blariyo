const AdminPostCommandService = require('../src/core/services/adminPostCommandService');

const ACTOR = `admin:v1:${'a'.repeat(43)}`;
const IDEMPOTENCY_KEY = 'draft-create-0001';

function createService(result) {
  const repository = {
    createDraft: jest.fn().mockResolvedValue(result),
    updateDraft: jest.fn().mockResolvedValue(result),
  };
  return { service: new AdminPostCommandService({ adminPostCommandRepository: repository }), repository };
}

describe('AdminPostCommandService', () => {
  it('초안 입력을 정규화하고 멱등 범위와 해시를 저장소에 전달한다', async () => {
    const responseBody = { postId: 1, status: 'DRAFT', lockVersion: 1 };
    const { service, repository } = createService({ kind: 'CREATED', responseBody });

    await expect(service.create({
      boardSlug: 'meme',
      title: '  제목  ',
      source: { name: ' 출처 ', url: 'https://example.com/original' },
      blocks: [
        { type: 'TEXT', text: '<tag> 그대로 저장' },
        { type: 'IMAGE', imageId: 501, alt: ' 이미지 ' },
      ],
    }, ACTOR, IDEMPOTENCY_KEY)).resolves.toEqual(responseBody);

    expect(repository.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      title: '제목',
      source: { name: '출처', url: 'https://example.com/original' },
      imageIds: [501],
      pinnedPosition: null,
    }), expect.objectContaining({
      actor: ACTOR,
      scope: 'POST /internal/v1/admin/posts',
      idempotencyKey: IDEMPOTENCY_KEY,
      requestHash: expect.any(Buffer),
    }));
  });

  it('같은 멱등키의 본문 해시가 다르면 충돌을 반환한다', async () => {
    const { service } = createService({
      kind: 'IDEMPOTENT',
      row: { request_hash: Buffer.alloc(32, 1), response_body: {} },
    });
    await expect(service.create({
      boardSlug: 'meme',
      title: '제목',
      blocks: [{ type: 'TEXT', text: '본문' }],
    }, ACTOR, IDEMPOTENCY_KEY)).rejects.toMatchObject({
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it.each([
    [{ boardSlug: 'meme', title: '제목', blocks: [] }, 'blocks'],
    [{ boardSlug: 'meme', title: '제목', blocks: [{ type: 'TEXT', text: ' ' }] }, 'blocks[0].text'],
    [{ boardSlug: 'meme', title: '제목', blocks: [
      { type: 'IMAGE', imageId: 1, alt: 'a' },
      { type: 'IMAGE', imageId: 1, alt: 'b' },
    ] }, 'blocks'],
    [{ boardSlug: 'meme', title: '제목', source: { name: 'x', url: 'http://example.com' }, blocks: [{ type: 'TEXT', text: '본문' }] }, 'source.url'],
  ])('잘못된 초안 필드를 거부한다', async (body, field) => {
    const { service } = createService({ kind: 'CREATED', responseBody: {} });
    await expect(service.create(body, ACTOR, IDEMPOTENCY_KEY)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: [{ field }],
    });
  });

  it('수정 결과를 외부 command 응답으로 제한한다', async () => {
    const { service, repository } = createService({
      kind: 'UPDATED',
      row: {
        id: '1047',
        status: 'DRAFT',
        lock_version: 2,
        updated_at: new Date('2026-08-17T01:00:00.000Z'),
      },
    });
    await expect(service.update('1047', {
      lockVersion: 1,
      source: null,
      blocks: [{ type: 'TEXT', text: '수정 본문' }],
    }, ACTOR)).resolves.toEqual({
      postId: 1047,
      status: 'DRAFT',
      lockVersion: 2,
      updatedAt: '2026-08-17T01:00:00.000Z',
    });
    expect(repository.updateDraft).toHaveBeenCalledWith(1047, {
      lockVersion: 1,
      source: null,
      blocks: [{ type: 'TEXT', text: '수정 본문' }],
      imageIds: [],
    }, ACTOR);
  });
});
