import { OrganizationsService } from './organizations.service';
import { NotFoundException } from '@nestjs/common';

describe('Organization isolation', () => {
  const repo = { findOne: jest.fn(), update: jest.fn() };
  const service = new OrganizationsService(repo as never);
  beforeEach(() => jest.clearAllMocks());
  it('denies another organization before reading its data', async () => {
    await expect(service.findById('org-b', 'org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });
  it('denies cross-tenant updates', async () => {
    await expect(service.update('org-b', 'org-a', { name: 'Changed' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('never writes protected IDs or relations from a settings payload', async () => {
    repo.findOne.mockResolvedValue({ id: 'org-a', name: 'Acme' });
    await service.update('org-a', 'org-a', { id: 'org-b', name: 'New name' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'org-a' }, { name: 'New name' });
  });
});
