import { PortalService } from './portal.service';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
const token = 'a'.repeat(64);
const request = { id: 'request-a', organizationId: 'org-a', customerId: 'customer-a', portalToken: token, status: 'sent', createdAt: new Date(), customer: { email: 'demo@example.test', firstName: 'Demo' }, organization: { name: 'Demo Lender' } };
describe('Portal OTP lifecycle', () => {
  let otp: { id: string; code: string; attempts: number; used: boolean; expiresAt: Date; createdAt: Date };
  const requests = { findOne: jest.fn(), update: jest.fn() };
  const otpRepo = { findOne: jest.fn(), update: jest.fn(), manager: {} };
  const jwt = { sign: jest.fn(() => 'portal-jwt') };
  const manager = { getRepository: jest.fn() };
  const service = new PortalService(otpRepo as never, requests as never, {} as never, jwt as never, new ConfigService({ JWT_SECRET: 'test-secret' }));
  beforeEach(() => {
    jest.clearAllMocks();
    otp = { id: 'otp-a', code: createHmac('sha256','test-secret').update(`${token}:123456`).digest('hex'), attempts: 0, used: false, expiresAt: new Date(Date.now()+600000), createdAt: new Date() };
    requests.findOne.mockResolvedValue(request);
    otpRepo.findOne.mockImplementation(async () => ({...otp}));
    otpRepo.update.mockImplementation(async (_id: string, patch: object) => Object.assign(otp, patch));
    manager.getRepository.mockImplementation(entity => entity.name === 'DocumentRequest' ? requests : otpRepo);
    otpRepo.manager = { transaction: (fn: (m: typeof manager) => unknown) => fn(manager) };
  });
  it('consumes the correct code and issues a request-scoped token', async () => {
    expect(await service.verifyOtp(token,'123456')).toEqual({ accessToken: 'portal-jwt' });
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ requestId:'request-a', organizationId:'org-a', sub:'customer-a', type:'portal' }), {expiresIn:'24h'});
    expect(otp.used).toBe(true);
  });
  it('rejects code reuse', async () => {
    await service.verifyOtp(token,'123456');
    await expect(service.verifyOtp(token,'123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('persists failed attempts and locks out after five guesses', async () => {
    for (let i=0;i<5;i++) await expect(service.verifyOtp(token,'654321')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(otp.attempts).toBe(5); expect(otp.used).toBe(true);
    await expect(service.verifyOtp(token,'123456')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  it('rejects expired codes', async () => {
    otp.expiresAt = new Date(0);
    await expect(service.verifyOtp(token,'123456')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it.each(['draft','cancelled','expired'])('blocks %s requests even with a valid code', async status => {
    requests.findOne.mockResolvedValue({...request,status});
    await expect(service.verifyOtp(token,'123456')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('blocks expired portal links', async () => {
    requests.findOne.mockResolvedValue({...request,portalExpiresAt:new Date(0)});
    await expect(service.getRequestByToken(token)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does not expose borrower identity before verification', async () => {
    const info = await service.getRequestByToken(token);
    expect(info).not.toHaveProperty('customer');
    expect(info.emailHint).toBe('d***@example.test');
  });
});
