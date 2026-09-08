import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './application.entity';
import { Customer } from '../customers/customer.entity';
import { User, UserStatus } from '../users/user.entity';
import { randomUUID } from 'crypto';
import { pickFields, assertEnum, requireText } from '../common/input';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly repo: Repository<Application>,
  ) {}

  findAll(organizationId: string) {
    return this.repo.find({
      where: { organizationId },
      relations: { customer: true, assignedUser: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, organizationId: string) {
    const app = await this.repo.findOne({
      where: { id, organizationId },
      relations: { customer: true, assignedUser: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async create(organizationId: string, dto: Partial<Application>) {
    requireText(dto.customerId, 'Customer');
    await this.validateReferences(organizationId, dto);
    const applicationNumber = `APP-${randomUUID()}`;
    return this.repo.save(this.repo.create({ ...pickFields(dto, ['customerId', 'assignedUserId', 'applicationType']), organizationId, applicationNumber, status: ApplicationStatus.DRAFT }));
  }

  async update(id: string, organizationId: string, dto: Partial<Application>) {
    await this.findById(id, organizationId);
    await this.validateReferences(organizationId, dto);
    const fields = pickFields(dto, ['assignedUserId', 'applicationType']);
    if (Object.keys(fields).length) await this.repo.update({ id, organizationId }, fields);
    return this.findById(id, organizationId);
  }

  async updateStatus(id: string, organizationId: string, status: ApplicationStatus) {
    assertEnum(status, ApplicationStatus);
    await this.findById(id, organizationId);
    await this.repo.update(id, { status });
    return this.findById(id, organizationId);
  }

  private async validateReferences(organizationId: string, dto: Partial<Application>) {
    if (dto.customerId && !await this.repo.manager.getRepository(Customer).findOne({ where: { id: dto.customerId, organizationId } })) throw new NotFoundException('Customer not found');
    if (dto.assignedUserId && !await this.repo.manager.getRepository(User).findOne({ where: { id: dto.assignedUserId, organizationId, status: UserStatus.ACTIVE } })) throw new NotFoundException('Assigned user not found');
  }
}
