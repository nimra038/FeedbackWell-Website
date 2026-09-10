import { Document } from '../documents/document.entity';
import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PortalOtp } from './portal-otp.entity';
import { DocumentRequest, DocumentRequestStatus } from '../document-requests/document-request.entity';
import { DocumentRequirement } from '../document-requests/document-requirement.entity';

@Injectable()
export class PortalService {
  private transporter: Transporter;

  constructor(
    @InjectRepository(PortalOtp) private readonly otpRepo: Repository<PortalOtp>,
    @InjectRepository(DocumentRequest) private readonly requestRepo: Repository<DocumentRequest>,
    @InjectRepository(DocumentRequirement) private readonly requirementRepo: Repository<DocumentRequirement>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.transporter = createTransport({
      host: config.get('SMTP_HOST'),
      port: Number(config.get('SMTP_PORT') || 587),
      secure: Number(config.get('SMTP_PORT')) === 465,
      auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') },
    });
  }

  async resolveRequest(portalToken: string) {
    if (!/^[a-f0-9]{64}$/.test(portalToken || '')) throw new NotFoundException('Request not found');
    const request = await this.requestRepo.findOne({ where: { portalToken }, relations: { customer: true, organization: true } });
    if (!request) throw new NotFoundException('Request not found');
    const expiresAt = request.portalExpiresAt || new Date(request.createdAt.getTime() + 30 * 86400000);
    if (expiresAt.getTime() <= Date.now()) throw new BadRequestException('This request link has expired');
    if ([DocumentRequestStatus.DRAFT, DocumentRequestStatus.EXPIRED, DocumentRequestStatus.CANCELLED].includes(request.status)) {
      throw new BadRequestException('This request is not available');
    }
    return request;
  }

  async getRequestByToken(portalToken: string) {
    const request = await this.resolveRequest(portalToken);
    const email = request.customer.email || '';
    const [local, domain] = email.split('@');
    return {
      title: request.title,
      dueDate: request.dueDate,
      status: request.status,
      organization: { name: request.organization.name, logo: request.organization.logo, brandColor: request.organization.brand_color },
      emailHint: domain ? `${local.slice(0, 1)}***@${domain}` : '',
    };
  }

  private hashCode(portalToken: string, code: string) {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secret).update(`${portalToken}:${code}`).digest('hex');
  }

  async sendOtp(portalToken: string) {
    const request = await this.resolveRequest(portalToken);
    if (!request.customer.email) throw new BadRequestException('Contact your lender to add an email address');
    const code = randomInt(100000, 1000000).toString();
    const otp = await this.otpRepo.manager.transaction(async manager => {
      await manager.getRepository(DocumentRequest).findOne({ where: { id: request.id }, lock: { mode: 'pessimistic_write' } });
      const repo = manager.getRepository(PortalOtp);
      const latest = await repo.findOne({ where: { portalToken }, order: { createdAt: 'DESC' } });
      const recent = await repo.count({ where: { portalToken, createdAt: MoreThan(new Date(Date.now() - 3600000)) } });
      if ((latest && Date.now() - latest.createdAt.getTime() < 60000) || recent >= 5) {
        throw new HttpException('Please wait before requesting another code', 429);
      }
      await repo.update({ portalToken, used: false }, { used: true });
      return repo.save(repo.create({ email: request.customer.email, portalToken, code: this.hashCode(portalToken, code), expiresAt: new Date(Date.now() + 600000), attempts: 0 }));
    });
    try {
      await this.transporter.sendMail({
        from: { name: request.organization.name, address: this.config.getOrThrow<string>('SMTP_FROM') },
        to: request.customer.email,
        subject: `Your verification code - ${request.organization.name}`,
        text: `Your verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
      });
    } catch {
      await this.otpRepo.update(otp.id, { used: true });
      throw new HttpException('The verification email could not be sent. Please try again later.', 503);
    }
    return { message: 'Verification code sent to your registered email' };
  }

  async verifyOtp(portalToken: string, code: string) {
    const request = await this.resolveRequest(portalToken);
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new UnauthorizedException('Invalid code');
    // Commit failed attempts too: throwing inside the transaction would roll them back.
    const valid = await this.otpRepo.manager.transaction(async manager => {
      await manager.getRepository(DocumentRequest).findOne({ where: { id: request.id }, lock: { mode: 'pessimistic_write' } });
      const repo = manager.getRepository(PortalOtp);
      const otp = await repo.findOne({ where: { portalToken }, order: { createdAt: 'DESC' } });
      if (!otp || otp.used || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= 5) return false;
      const actual = Buffer.from(this.hashCode(portalToken, code));
      const expected = Buffer.from(otp.code);
      const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
      await repo.update(otp.id, { attempts: otp.attempts + 1, used: matches || otp.attempts + 1 >= 5 });
      if (matches && request.status === DocumentRequestStatus.SENT) {
        await manager.getRepository(DocumentRequest).update(request.id, { status: DocumentRequestStatus.OPENED });
      }
      return matches;
    });
    if (!valid) throw new UnauthorizedException('Invalid or expired code. Request a new code if needed.');
    return { accessToken: this.jwtService.sign({ sub: request.customerId, portalToken, requestId: request.id, organizationId: request.organizationId, type: 'portal' }, { expiresIn: '24h' }) };
  }

  async getRequirements(portalToken: string) {
    const request = await this.resolveRequest(portalToken);
    const requirements = await this.requirementRepo.find({ where: { requestId: request.id }, order: { createdAt: 'ASC' } });
    const documents = await this.requestRepo.manager.getRepository(Document).find({ where: { organizationId: request.organizationId, customerId: request.customerId, requirement: { requestId: request.id } } });
    return {
      total: requirements.length,
      completed: requirements.filter(r => ['accepted', 'not_applicable'].includes(r.status)).length,
      requirements: requirements.map(requirement => ({ ...requirement, documents: documents.filter(doc => doc.requirementId === requirement.id).map(doc => ({ id: doc.id, originalName: doc.originalName, fileSize: doc.fileSize, mimeType: doc.mimeType, createdAt: doc.createdAt })) })),
      customer: { firstName: request.customer.firstName },
      description: request.description,
      status: request.status,
    };
  }
}
