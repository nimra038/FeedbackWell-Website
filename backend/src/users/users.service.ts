import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { StaffInvitation } from './invitation.entity';
import { Organization } from '../organizations/organization.entity';
import { Notification } from '../notifications/notification.entity';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from './user.entity';
import { assertEnum, pickFields, requireText } from '../common/input';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  findAll(organizationId: string) {
    return this.repo.find({ where: { organizationId } });
  }

  async findById(id: string, organizationId: string) {
    const user = await this.repo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async invite(organizationId: string, dto: { firstName: string; lastName: string; email: string; role: UserRole }) {
    assertEnum(dto.role, UserRole);
    if (dto.role === UserRole.OWNER) throw new ForbiddenException('Ownership cannot be granted through an invitation');
    requireText(dto.email, 'Email');
    requireText(dto.firstName, 'First name');
    requireText(dto.lastName, 'Last name');
    const email = dto.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email');
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.PORTAL_BASE_URL) throw new BadRequestException('Invitation email delivery is not configured');
    const token = randomBytes(32).toString('hex');
    return this.repo.manager.transaction(async manager => {
      const users = manager.getRepository(User);
      const existing = await users.findOne({ where: { email } });
      if (existing) throw new ConflictException('This email already has an account or pending invitation');
      const user = await users.save(users.create({ ...pickFields(dto, ['firstName', 'lastName', 'role']), email, organizationId, status: UserStatus.INVITED, invitedAt: new Date() }));
      const organization = await manager.getRepository(Organization).findOneBy({ id: organizationId });
      if (!organization) throw new NotFoundException('Organization not found');
      const invitations = manager.getRepository(StaffInvitation);
      const invitation = await invitations.save(invitations.create({ organizationId, userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 48 * 3600000) }));
      const link = new URL(`/accept-invite/${token}`, process.env.PORTAL_BASE_URL).toString();
      const notifications = manager.getRepository(Notification);
      await notifications.save(notifications.create({ organizationId, requestId: '', dedupeKey: `invitation:${invitation.id}`, recipient: email, senderName: organization.name, subject: `Join ${organization.name} on FeedbackWell`, body: `You have been invited to join your team. Create your password using this one-time link within 48 hours: ${link}` }));
      return user;
    });
  }

  async updateRole(id: string, organizationId: string, role: UserRole) {
    assertEnum(role, UserRole);
    if (role === UserRole.OWNER) throw new ForbiddenException('Ownership cannot be granted through a role update');
    const user = await this.findById(id, organizationId);
    if (user.role === UserRole.OWNER) throw new ForbiddenException('Cannot change owner role');
    await this.repo.update(id, { role });
    return this.findById(id, organizationId);
  }

  async deactivate(id: string, organizationId: string) {
    const user = await this.findById(id, organizationId);
    if (user.role === UserRole.OWNER) throw new ForbiddenException('Cannot deactivate the organization owner');
    await this.repo.update(id, { status: UserStatus.INACTIVE });
  }

  async acceptInvite(token: string, password: string) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Invalid invitation');
    if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) throw new BadRequestException('Use a password of at least 12 characters (maximum 72 bytes)');
    const passwordHash = await bcrypt.hash(password, 12);
    return this.repo.manager.transaction(async manager => {
      const invitations = manager.getRepository(StaffInvitation);
      const invitation = await invitations.findOne({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, lock: { mode: 'pessimistic_write' } });
      if (!invitation || invitation.usedAt || invitation.expiresAt.getTime() <= Date.now()) throw new BadRequestException('This invitation is invalid or expired');
      const users = manager.getRepository(User);
      const user = await users.findOneBy({ id: invitation.userId, organizationId: invitation.organizationId, status: UserStatus.INVITED });
      if (!user) throw new BadRequestException('This invitation is no longer active');
      await users.update(user.id, { passwordHash, status: UserStatus.ACTIVE });
      await invitations.update(invitation.id, { usedAt: new Date() });
      return { accessToken: this.jwt.sign({ sub: user.id, orgId: user.organizationId }) };
    });
  }
}
