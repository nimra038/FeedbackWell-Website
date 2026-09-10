import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Customer, CustomerStatus, CustomerType } from './customer.entity';
import { pickFields, assertEnum, requireText } from '../common/input';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
  ) {}

  findAll(organizationId: string, search?: string) {
    if (search) {
      return this.repo.find({
        where: [
          { organizationId, firstName: ILike(`%${search}%`) },
          { organizationId, lastName: ILike(`%${search}%`) },
          { organizationId, email: ILike(`%${search}%`) },
          { organizationId, companyName: ILike(`%${search}%`) },
        ],
      });
    }
    return this.repo.find({ where: { organizationId } });
  }

  async findById(id: string, organizationId: string) {
    const customer = await this.repo.findOne({ where: { id, organizationId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(organizationId: string, dto: Partial<Customer>) {
    requireText(dto.firstName, 'First name');
    requireText(dto.lastName, 'Last name');
    return this.repo.save(this.repo.create({ ...this.editable(dto), organizationId }));
  }

  async update(id: string, organizationId: string, dto: Partial<Customer>) {
    await this.findById(id, organizationId);
    const fields = this.editable(dto);
    if (Object.keys(fields).length) await this.repo.update({ id, organizationId }, fields);
    return this.findById(id, organizationId);
  }

  async archive(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    await this.repo.update(id, { status: CustomerStatus.ARCHIVED });
  }

  private editable(dto: Partial<Customer>) {
    if (dto.status !== undefined) assertEnum(dto.status, CustomerStatus);
    if (dto.customerType !== undefined) assertEnum(dto.customerType, CustomerType);
    return pickFields(dto, ['firstName', 'lastName', 'email', 'phone', 'companyName', 'customerType', 'externalReference', 'status']);
  }
}
