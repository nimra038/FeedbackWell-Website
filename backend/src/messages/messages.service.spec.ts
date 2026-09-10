import { MessagesService } from './messages.service.js';
import { NotFoundException } from '@nestjs/common';

describe('Message access and note privacy', () => {
  const requests = { findOne: jest.fn() };
  const repo = { manager: { getRepository: () => requests }, find: jest.fn(), save: jest.fn(), create: jest.fn(x => x) };
  const service = new MessagesService(repo as never);
  beforeEach(() => jest.clearAllMocks());
  it('blocks reading a foreign request including internal notes', async () => {
    requests.findOne.mockResolvedValue(null);
    await expect(service.getForRequest('request-b', 'org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.find).not.toHaveBeenCalled();
  });
  it('always filters internal notes for a borrower', async () => {
    requests.findOne.mockResolvedValue({ id: 'request-a' });
    await service.getForRequest('request-a', 'org-a', true);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { requestId: 'request-a', organizationId: 'org-a', isInternal: false } }));
  });
});
