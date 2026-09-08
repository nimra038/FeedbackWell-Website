import { DocumentRequestsService } from './document-requests.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RequirementStatus } from './document-requirement.entity';
import { DocumentRequestStatus } from './document-request.entity';

describe('Request and requirement isolation', () => {
  const requests = { findOne: jest.fn(), update: jest.fn() };
  const requirements = { findOne: jest.fn(), find: jest.fn(), update: jest.fn(), delete: jest.fn(), save: jest.fn() };
  const service = new DocumentRequestsService(requests as never, requirements as never);
  beforeEach(() => jest.clearAllMocks());
  it('does not list requirements of a foreign request', async () => {
    requests.findOne.mockResolvedValue(null);
    await expect(service.getRequirements('request-b', 'org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(requirements.find).not.toHaveBeenCalled();
  });
  it('does not update a foreign requirement', async () => {
    requirements.findOne.mockResolvedValue(null);
    await expect(service.updateRequirementStatus('req-b', 'org-a', RequirementStatus.ACCEPTED)).rejects.toBeInstanceOf(NotFoundException);
    expect(requirements.update).not.toHaveBeenCalled();
  });
  it('does not delete a foreign requirement', async () => {
    requirements.findOne.mockResolvedValue(null);
    await expect(service.deleteRequirement('req-b', 'org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(requirements.delete).not.toHaveBeenCalled();
  });
  it('blocks completion with missing required documents', async () => {
    requests.findOne.mockResolvedValue({ id: 'request-a' });
    requirements.find.mockResolvedValue([{ required: true, status: RequirementStatus.MISSING }]);
    await expect(service.updateStatus('request-a', 'org-a', DocumentRequestStatus.COMPLETED)).rejects.toBeInstanceOf(BadRequestException);
    expect(requests.update).not.toHaveBeenCalled();
  });
});
