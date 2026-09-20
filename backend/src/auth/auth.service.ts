import { requireText } from '../common/input.js';
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { createTransport } from 'nodemailer';
import { User, UserStatus, UserRole } from '../users/user.entity.js';
import { Organization } from '../organizations/organization.entity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private validatePassword(password: string) {
    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password) > 72 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      throw new BadRequestException(
        'Password must be 12-72 characters and include uppercase, lowercase, number, and special character',
      );
    }
  }

  async register(dto: {
    orgName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    requireText(dto.orgName, 'Organization name', 200);
    requireText(dto.firstName, 'First name', 100);
    requireText(dto.lastName, 'Last name', 100);
    requireText(dto.email, 'Email', 254);
    requireText(dto.password, 'Password', 128);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Enter a valid email address');
    }

    this.validatePassword(dto.password);

    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.userRepo.manager.transaction(async (manager) => {
        const users = manager.getRepository(User);

        if (await users.findOneBy({ email })) {
          throw new ConflictException('Email already registered');
        }

        const organizations = manager.getRepository(Organization);
        const org = await organizations.save(
          organizations.create({ name: dto.orgName.trim() }),
        );

        const user = await users.save(
          users.create({
            organizationId: org.id,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email,
            passwordHash,
            role: UserRole.OWNER,
            status: UserStatus.ACTIVE,
          }),
        );

        return { accessToken: this.signToken(user.id, org.id) };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      Buffer.byteLength(password) > 72
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        organizationId: true,
        passwordHash: true,
        status: true,
      },
    });

    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return { accessToken: this.signToken(user.id, user.organizationId) };
  }

  async forgotPassword(emailInput: string) {
    const genericResponse = {
      message: 'If an account exists for that email, a password reset link has been sent.',
    };

    if (typeof emailInput !== 'string') return genericResponse;

    const email = emailInput.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return genericResponse;

    const user = await this.userRepo.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) return genericResponse;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.userRepo.update(user.id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const resetUrl = new URL('/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', rawToken);

    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpFrom = this.config.get<string>('SMTP_FROM');

    if (!smtpHost || !smtpFrom) {
      await this.userRepo.update(user.id, {
        passwordResetTokenHash: null as never,
        passwordResetExpiresAt: null as never,
      });

      throw new ServiceUnavailableException(
        'Password reset email service is not configured',
      );
    }

    const port = Number(this.config.get('SMTP_PORT') || 587);

    const mailer = createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    try {
      await mailer.sendMail({
        from: {
          name: 'FeedbackWell',
          address: smtpFrom,
        },
        to: user.email,
        subject: 'Reset your FeedbackWell password',
        text:
          `Hi ${user.firstName},\n\n` +
          `Use the link below to reset your FeedbackWell password. This link expires in 30 minutes.\n\n` +
          `${resetUrl.toString()}\n\n` +
          `If you did not request this, you can safely ignore this email.`,
        html: `
          <div style="background:#f5f5f5;padding:32px;font-family:Arial,sans-serif">
            <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px">
              <h2 style="margin:0;color:#1a2744">Reset your password</h2>
              <p style="color:#475569;line-height:1.7">Hi ${user.firstName},</p>
              <p style="color:#475569;line-height:1.7">
                We received a request to reset your FeedbackWell password.
                This link expires in 30 minutes.
              </p>
              <p style="margin:28px 0">
                <a href="${resetUrl.toString()}" style="background:#1a2744;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:600">
                  Reset password
                </a>
              </p>
              <p style="font-size:13px;color:#64748b;line-height:1.6">
                If you did not request this, you can safely ignore this email.
              </p>
            </div>
          </div>
        `,
      });
    } catch {
      await this.userRepo.update(user.id, {
        passwordResetTokenHash: null as never,
        passwordResetExpiresAt: null as never,
      });

      throw new ServiceUnavailableException(
        'Password reset email could not be sent. Please try again later.',
      );
    } finally {
      mailer.close();
    }

    return genericResponse;
  }

  async resetPassword(token: string, password: string) {
    if (typeof token !== 'string' || token.length < 32) {
      throw new BadRequestException('Invalid or expired password reset link');
    }

    this.validatePassword(password);

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenHash')
      .addSelect('user.passwordResetExpiresAt')
      .where('user.passwordResetTokenHash = :tokenHash', { tokenHash })
      .andWhere('user.passwordResetExpiresAt > :now', { now: new Date() })
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset link');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.userRepo.update(user.id, {
      passwordHash,
      passwordResetTokenHash: null as never,
      passwordResetExpiresAt: null as never,
    });

    return {
      message: 'Password reset successfully. You can now sign in with your new password.',
    };
  }

  private signToken(userId: string, orgId: string) {
    return this.jwtService.sign({ sub: userId, orgId });
  }
}
