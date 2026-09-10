import { OrganizationsController } from './organizations.controller.js';

describe('Organization controller scope', () => {
  it('passes the authenticated tenant separately from the supplied ID', async () => {
    const service = { findById: jest.fn(), update: jest.fn() };
    const controller = new OrganizationsController(service as never);
    const req = { user: { organizationId: 'org-a' } };
    controller.findOne('org-b', req);
    controller.update('org-b', { name: 'Changed' }, req);
    expect(service.findById).toHaveBeenCalledWith('org-b', 'org-a');
    expect(service.update).toHaveBeenCalledWith('org-b', 'org-a', { name: 'Changed' });
  });
});
