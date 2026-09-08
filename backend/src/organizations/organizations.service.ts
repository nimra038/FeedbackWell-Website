import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { pickFields, requireText } from '../common/input';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly repo: Repository<Organization>,
  ) {}

  create(data: Partial<Organization>) {
    return this.repo.save(this.repo.create(data));
  }

  async findById(id: string, organizationId: string) {
    if (id !== organizationId) throw new NotFoundException('Organization not found');
    const organization = await this.repo.findOne({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async update(id: string, organizationId: string, data: Partial<Organization>) {
    await this.findById(id, organizationId);
    const editable = pickFields(data, ['name', 'legal_name', 'industry', 'type', 'logo', 'brand_color', 'website', 'timezone', 'country']);
    if (editable.name !== undefined) requireText(editable.name, 'Organization name');
    if (Object.keys(editable).length) await this.repo.update({ id: organizationId }, editable);
    return this.findById(id, organizationId);
  }
}
