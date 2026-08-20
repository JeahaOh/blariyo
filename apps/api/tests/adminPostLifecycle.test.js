const AdminPostLifecycleService = require('../src/core/services/adminPostLifecycleService');

const ACTOR = `admin:v1:${'b'.repeat(43)}`;
const KEY = 'lifecycle-command-0001';
const NOW = new Date('2026-08-17T00:00:00.000Z');

function setup(overrides = {}) {
  const completed = {
    kind: 'COMPLETED',
    responseBody: {
      postId: 10,
      status: 'PUBLISHED',
      lockVersion: 2,
      publishedAt: NOW.toISOString(),
      scheduledAt: null,
    },
  };
  const repository = {
    runIdempotent: jest.fn(async (_meta, operation) => operation({})),
    preparePublish: jest.fn().mockResolvedValue({
      kind: 'READY',
      post: { id: '10', status: 'DRAFT', lock_version: 1 },
      images: [{ id: '20' }],
    }),
    prepareRepublish: jest.fn().mockResolvedValue({
      kind: 'READY',
      post: { id: '10', status: 'HIDDEN_REVIEW', lock_version: 3 },
      images: [{ id: '20', status: 'PRIVATE_REVIEW' }],
    }),
    publish: jest.fn().mockResolvedValue(completed),
    schedule: jest.fn().mockResolvedValue(completed),
    unschedule: jest.fn().mockResolvedValue(completed),
    hide: jest.fn().mockResolvedValue(completed),
    republish: jest.fn().mockResolvedValue(completed),
    remove: jest.fn().mockResolvedValue(completed),
    ...overrides.repository,
  };
  const mediaPromotionService = {
    promote: jest.fn().mockResolvedValue([{ imageId: '20', publicStorageKey: 'posts/10/20-hash.png' }]),
    ...overrides.mediaPromotionService,
  };
  return {
    repository,
    mediaPromotionService,
    service: new AdminPostLifecycleService({
      adminPostLifecycleRepository: repository,
      mediaPromotionService,
      clock: () => NOW,
    }),
  };
}

describe('AdminPostLifecycleService', () => {
  it('즉시 발행 전에 private 이미지를 public key로 승격한다', async () => {
    const { service, repository, mediaPromotionService } = setup();
    await service.publish('10', { lockVersion: 1, mode: 'IMMEDIATE' }, ACTOR, KEY);
    expect(mediaPromotionService.promote).toHaveBeenCalledWith(10, [{ id: '20' }]);
    expect(repository.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'READY' }),
      [{ imageId: '20', publicStorageKey: 'posts/10/20-hash.png' }],
      expect.objectContaining({ actor: ACTOR }),
      NOW,
    );
  });

  it('예약은 1분 이상 미래 시각만 허용하고 이미지를 미리 공개하지 않는다', async () => {
    const { service, repository, mediaPromotionService } = setup();
    await service.publish('10', {
      lockVersion: 1,
      mode: 'SCHEDULED',
      scheduledAt: '2026-08-17T00:02:00.000Z',
    }, ACTOR, KEY);
    expect(repository.schedule).toHaveBeenCalled();
    expect(mediaPromotionService.promote).not.toHaveBeenCalled();

    await expect(service.publish('10', {
      lockVersion: 1,
      mode: 'SCHEDULED',
      scheduledAt: '2026-08-17T00:00:59.999Z',
    }, ACTOR, 'another-key')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'scheduledAt', reason: 'minimumLeadTime' }],
    });
  });

  it('동일 command 처리 중이면 Retry 가능한 멱등 충돌을 반환한다', async () => {
    const { service } = setup({
      repository: { runIdempotent: jest.fn().mockResolvedValue({ kind: 'IDEMPOTENCY_IN_PROGRESS' }) },
    });
    await expect(service.hide('10', {
      lockVersion: 2,
      reasonCode: 'RIGHTS_EMAIL',
    }, ACTOR, KEY)).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_IN_PROGRESS' });
  });

  it('이미지 승격 실패는 DB 발행 없이 503으로 닫는다', async () => {
    const { service, repository } = setup({
      mediaPromotionService: { promote: jest.fn().mockRejectedValue(new Error('R2_DOWN')) },
    });
    await expect(service.publish(
      '10',
      { lockVersion: 1, mode: 'IMMEDIATE' },
      ACTOR,
      KEY,
    )).rejects.toMatchObject({ status: 503, code: 'DEPENDENCY_UNAVAILABLE' });
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it('재공개는 private 원본을 다시 승격하고 최초 발행 시각은 command로 덮어쓰지 않는다', async () => {
    const { service, repository, mediaPromotionService } = setup();
    await service.republish(
      '10',
      { lockVersion: 3, pinnedPosition: null },
      ACTOR,
      'republish-command-0001'
    );
    expect(repository.prepareRepublish).toHaveBeenCalledWith(expect.anything(), 10, 3);
    expect(mediaPromotionService.promote).toHaveBeenCalledWith(
      10,
      [{ id: '20', status: 'PRIVATE_REVIEW' }]
    );
    expect(repository.republish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'READY' }),
      [{ imageId: '20', publicStorageKey: 'posts/10/20-hash.png' }],
      { lockVersion: 3, pinnedPosition: null },
      expect.objectContaining({ actor: ACTOR }),
      NOW
    );
  });

  it('최종 삭제는 저장소를 직접 지우지 않고 repository command로 위임한다', async () => {
    const { service, repository, mediaPromotionService } = setup();
    await service.remove(
      '10',
      { lockVersion: 4, reasonCode: 'RIGHTS_EMAIL' },
      ACTOR,
      'remove-command-0001'
    );
    expect(repository.remove).toHaveBeenCalledWith(
      expect.anything(),
      10,
      { lockVersion: 4, reasonCode: 'RIGHTS_EMAIL' },
      expect.objectContaining({ actor: ACTOR }),
      NOW
    );
    expect(mediaPromotionService.promote).not.toHaveBeenCalled();
  });

  it('재공개 공지 순서와 최종 삭제 사유를 엄격하게 검증한다', async () => {
    const { service } = setup();
    await expect(service.republish(
      '10',
      { lockVersion: 3 },
      ACTOR,
      'republish-command-0002'
    )).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'pinnedPosition', reason: 'required' }],
    });
    await expect(service.remove(
      '10',
      { lockVersion: 4, reasonCode: 'MANUAL' },
      ACTOR,
      'remove-command-0002'
    )).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'reasonCode', reason: 'unsupportedValue' }],
    });
  });
});
