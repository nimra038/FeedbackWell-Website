import { PortalGuard } from './portal.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('Borrower request boundary', () => {
  const jwt = { verify: jest.fn() };
  const portal = { resolveRequest: jest.fn() };
  const guard = new PortalGuard(jwt as never, { get: () => 'secret' } as never, portal as never);
  const req = { headers: { authorization: 'Bearer token' }, params: { token: 'link-a' } };
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as never;
  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReturnValue({ type: 'portal', portalToken: 'link-a', sub: 'customer-a', organizationId: 'org-a', requestId: 'request-a' });
    portal.resolveRequest.mockResolvedValue({ id: 'request-a', organizationId: 'org-a', customerId: 'customer-a' });
  });
  it('accepts only the verified request', async () => expect(await guard.canActivate(context)).toBe(true));
  it('rejects changing the link while reusing a token', async () => {
    jwt.verify.mockReturnValue({ type: 'portal', portalToken: 'link-b' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(portal.resolveRequest).not.toHaveBeenCalled();
  });
  it('rejects a mismatched borrower', async () => {
    portal.resolveRequest.mockResolvedValue({ id: 'request-a', organizationId: 'org-a', customerId: 'customer-b' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rechecks revoked request access on every call', async () => {
    portal.resolveRequest.mockRejectedValue(new Error('cancelled'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
