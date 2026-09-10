import { DocumentsService } from './documents.service';
import { NotFoundException } from '@nestjs/common';

describe('Document tenant boundary', () => {
  const docs = { findOne: jest.fn(), save: jest.fn() };
  const versions = { find: jest.fn() };
  const requirements = { findOne: jest.fn() };
  const service = new DocumentsService(docs as never, versions as never, requirements as never, {} as never);
  beforeEach(() => jest.clearAllMocks());
  it('checks document ownership before returning versions', async () => {
    docs.findOne.mockResolvedValue(null);
    await expect(service.getVersions('doc-b', 'org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(versions.find).not.toHaveBeenCalled();
  });
  it('rejects uploading against another request before saving any data', async () => {
    requirements.findOne.mockResolvedValue(null);
    await expect(service.upload('org-a', 'customer-a', 'req-b', 'customer-a', {} as never, 'request-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(docs.save).not.toHaveBeenCalled();
  });
});
