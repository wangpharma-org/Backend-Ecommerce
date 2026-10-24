import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService.updateFlag (ECWC-749 change log)', () => {
  const make = (existing: { is_enabled: boolean } | null) => {
    const flagRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((v: unknown) => v),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
    };
    const logRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn((v: unknown) => Promise.resolve(v)),
      find: jest.fn().mockResolvedValue([]),
    };
    const service = new FeatureFlagsService(
      flagRepo as never,
      logRepo as never,
    );
    return { service, flagRepo, logRepo };
  };
  const actor = { mem_code: 'A001', username: 'admin1', role: 'Admin' };

  it('updates an existing flag and logs old → new with the actor', async () => {
    const { service, flagRepo, logRepo } = make({ is_enabled: true });
    await expect(
      service.updateFlag({ flag: 'all', status: false }, actor),
    ).resolves.toBe('Success');
    expect(flagRepo.update).toHaveBeenCalledWith(
      { feature_key: 'all' },
      { is_enabled: false },
    );
    expect(logRepo.save).toHaveBeenCalledWith({
      feature_key: 'all',
      old_value: true,
      new_value: false,
      actor_mem_code: 'A001',
      actor_username: 'admin1',
      actor_role: 'Admin',
    });
  });

  it('creates a missing flag and logs old_value null', async () => {
    const { service, flagRepo, logRepo } = make(null);
    await service.updateFlag({ flag: 'new_one', status: true }, actor);
    expect(flagRepo.update).not.toHaveBeenCalled();
    expect(flagRepo.save).toHaveBeenCalledWith({
      feature_key: 'new_one',
      is_enabled: true,
    });
    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ old_value: null, new_value: true }),
    );
  });

  it('still changes the flag when writing the log fails', async () => {
    const { service, flagRepo, logRepo } = make({ is_enabled: false });
    logRepo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.updateFlag({ flag: 'preorder', status: true }, actor),
    ).resolves.toBe('Success');
    expect(flagRepo.update).toHaveBeenCalled();
  });

  it('does not log when called without an actor (internal callers)', async () => {
    const { service, logRepo } = make({ is_enabled: false });
    await service.updateFlag({ flag: 'x', status: true });
    expect(logRepo.save).not.toHaveBeenCalled();
  });

  it('lists logs newest first, filtered by flag', async () => {
    const { service, logRepo } = make(null);
    await service.getChangeLogs('all', 20);
    expect(logRepo.find).toHaveBeenCalledWith({
      where: { feature_key: 'all' },
      order: { created_at: 'DESC', id: 'DESC' },
      take: 20,
    });
  });
});
