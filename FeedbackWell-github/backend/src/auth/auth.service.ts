import { requireText } from '../common/input';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserStatus, UserRole } from '../users/user.entity';
import { Organization } from '../organizations/organization.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: { orgName: string; firstName: string; lastName: string; email: string; password: string }) {
    requireText(dto.orgName, 'Organization name', 200);
    requireText(dto.firstName, 'First name', 100);
    requireText(dto.lastName, 'Last name', 100);
    requireText(dto.email, 'Email', 254);
    requireText(dto.password, 'Password', 128);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email) || dto.password.length < 12 || Buffer.byteLength(dto.password) > 72) throw new BadRequestException('Use a valid email and a password of at least 12 characters (maximum 72 bytes)');
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.userRepo.manager.transaction(async manager => {
        const users = manager.getRepository(User);
        if (await users.findOneBy({ email })) throw new ConflictException('Email already registered');
        const organizations = manager.getRepository(Organization);
        const org = await organizations.save(organizations.create({ name: dto.orgName.trim() }));
        const user = await users.save(users.create({ organizationId: org.id, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), email, passwordHash, role: UserRole.OWNER, status: UserStatus.ACTIVE }));
        return { accessToken: this.signToken(user.id, org.id) };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(email: string, password: string) {
    if (typeof email !== 'string' || typeof password !== 'string' || Buffer.byteLength(password) > 72) throw new UnauthorizedException('Invalid credentials');
    const user = await this.userRepo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, organizationId: true, passwordHash: true, status: true },
    });

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return { accessToken: this.signToken(user.id, user.organizationId) };
  }

  private signToken(userId: string, orgId: string) {
    return this.jwtService.sign({ sub: userId, orgId });
  }
}
