import { JwtAuthGuard } from './jwt-auth.guard';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '../../users/user.entity';

describe('Staff authentication and authorization', () => {
  const jwt = { verify: jest.fn() };
  const repo = { findOne: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new JwtAuthGuard(jwt as never, { get: () => 'test-secret' } as never, repo as never, reflector as never);
  const req = { headers: { authorization: 'Bearer token' } };
  const context = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null } as never;
  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReturnValue({ sub: 'staff-a', orgId: 'org-a' });
    repo.findOne.mockResolvedValue({ id: 'staff-a', organizationId: 'org-a', status: UserStatus.ACTIVE, role: UserRole.READ_ONLY });
    reflector.getAllAndOverride.mockReturnValue('documents.read');
  });
  it('allows an active reader to read documents', async () => expect(await guard.canActivate(context)).toBe(true));
  it('blocks a reader from user management', async () => {
    reflector.getAllAndOverride.mockReturnValue('users.manage');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each([UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.INVITED])('rejects %s staff with an existing token', async status => {
    repo.findOne.mockResolvedValue({ organizationId: 'org-a', status });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects a token for another organization', async () => {
    jwt.verify.mockReturnValue({ sub: 'staff-a', orgId: 'org-b' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects a borrower token on staff endpoints', async () => {
    jwt.verify.mockReturnValue({ sub: 'staff-a', orgId: 'org-a', type: 'portal' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
