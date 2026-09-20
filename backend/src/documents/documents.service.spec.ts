import { DocumentsService } from './documents.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Document tenant boundary', () => {
  const docs = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };
  const versions = { find: jest.fn() };
  const requirements = { findOne: jest.fn() };
  const security = { inspect: jest.fn(), scan: jest.fn() };
  const jwt = { sign: jest.fn(), verify: jest.fn() };

  const service = new DocumentsService(
    docs as never,
    versions as never,
    requirements as never,
    security as never,
    jwt as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReset();
  });

  it('checks document ownership before returning versions', async () => {
    docs.findOne.mockResolvedValue(null);

    await expect(service.getVersions('doc-b', 'org-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(versions.find).not.toHaveBeenCalled();
  });

  it('rejects uploading against another request before saving any data', async () => {
    requirements.findOne.mockResolvedValue(null);

    await expect(
      service.upload(
        'org-a',
        'customer-a',
        'req-b',
        'customer-a',
        {} as never,
        'request-a',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(docs.save).not.toHaveBeenCalled();
  });

  it('rejects preparing a direct upload for a foreign requirement', async () => {
    requirements.findOne.mockResolvedValue(null);

    await expect(
      service.prepareDirectUpload(
        'org-a',
        'customer-a',
        'request-a',
        'requirement-b',
        'statement.pdf',
        'application/pdf',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(docs.count).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired upload intent before reading the blob', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(
      service.finalizeDirectUpload(
        'org-a',
        'customer-a',
        'request-a',
        'requirement-a',
        'customer-a',
        'org/org-a/customers/customer-a/requirements/requirement-a/file.pdf',
        'statement.pdf',
        'bad-upload-intent',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(requirements.findOne).not.toHaveBeenCalled();
    expect(security.inspect).not.toHaveBeenCalled();
    expect(security.scan).not.toHaveBeenCalled();
  });

  it('rejects a direct upload path outside the customer requirement scope', async () => {
    const storagePath =
      'org/org-b/customers/customer-b/requirements/requirement-a/file.pdf';

    jwt.verify.mockReturnValue({
      type: 'upload-intent',
      organizationId: 'org-a',
      customerId: 'customer-a',
      requestId: 'request-a',
      requirementId: 'requirement-a',
      pathname: storagePath,
      originalName: 'statement.pdf',
      documentId: null,
    });

    requirements.findOne.mockResolvedValue({
      id: 'requirement-a',
      requestId: 'request-a',
      request: { status: 'in_progress' },
      maxFileSizeMb: 50,
    });

    await expect(
      service.finalizeDirectUpload(
        'org-a',
        'customer-a',
        'request-a',
        'requirement-a',
        'customer-a',
        storagePath,
        'statement.pdf',
        'valid-upload-intent',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(security.inspect).not.toHaveBeenCalled();
    expect(security.scan).not.toHaveBeenCalled();
  });
});
