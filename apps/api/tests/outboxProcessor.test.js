const OutboxProcessor = require('../src/jobs/processOutboxBatch');

describe('OutboxProcessor', () => {
  it('cache·public object·private object 작업을 adapter로 실행하고 완료한다', async () => {
    const tasks = [
      { id: 1, type: 'CACHE_PURGE', payload: { paths: ['/meme'] } },
      { id: 2, type: 'OBJECT_DELETE_PUBLIC', payload: { publicStorageKey: 'public/key' } },
      { id: 3, type: 'OBJECT_DELETE_PRIVATE', payload: { privateStorageKey: 'private/key' } },
    ];
    const repository = {
      recoverStale: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn(async () => tasks.shift() || null),
      complete: jest.fn().mockResolvedValue(true),
      fail: jest.fn(),
    };
    const privateMediaStorage = { delete: jest.fn().mockResolvedValue(undefined) };
    const publicMediaStorage = { delete: jest.fn().mockResolvedValue(undefined) };
    const cachePurge = { purge: jest.fn().mockResolvedValue(undefined) };
    const processor = new OutboxProcessor({
      outboxRepository: repository,
      privateMediaStorage,
      publicMediaStorage,
      cachePurge,
      clock: () => new Date('2026-08-17T00:00:00.000Z'),
    });

    await expect(processor.processBatch()).resolves.toEqual({
      recovered: 0,
      processed: 3,
      succeeded: 3,
      failed: 0,
    });
    expect(cachePurge.purge).toHaveBeenCalledWith(['/meme']);
    expect(publicMediaStorage.delete).toHaveBeenCalledWith('public/key');
    expect(privateMediaStorage.delete).toHaveBeenCalledWith('private/key');
    expect(repository.complete).toHaveBeenCalledTimes(3);
  });

  it('외부 실패는 오류 코드를 저장하고 다음 작업을 계속한다', async () => {
    const tasks = [
      { id: 1, type: 'CACHE_PURGE', payload: { paths: ['/meme'] } },
      { id: 2, type: 'OBJECT_DELETE_PRIVATE', payload: { privateStorageKey: 'private/key' } },
    ];
    const repository = {
      recoverStale: jest.fn().mockResolvedValue(1),
      claimNext: jest.fn(async () => tasks.shift() || null),
      complete: jest.fn().mockResolvedValue(true),
      fail: jest.fn().mockResolvedValue(true),
    };
    const processor = new OutboxProcessor({
      outboxRepository: repository,
      privateMediaStorage: { delete: jest.fn().mockResolvedValue(undefined) },
      publicMediaStorage: { delete: jest.fn() },
      cachePurge: { purge: jest.fn().mockRejectedValue(new Error('CACHE_PURGE_FAILED')) },
      clock: () => new Date('2026-08-17T00:00:00.000Z'),
    });
    await expect(processor.processBatch()).resolves.toEqual({
      recovered: 1,
      processed: 2,
      succeeded: 1,
      failed: 1,
    });
    expect(repository.fail).toHaveBeenCalledWith(1, 'CACHE_PURGE_FAILED', expect.any(Date));
  });
});
