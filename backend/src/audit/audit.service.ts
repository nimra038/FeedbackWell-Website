import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event.entity.js';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
  ) {}

  log(data: {
    organizationId: string;
    actorId?: string;
    actorType: 'user' | 'customer' | 'system';
    action: string;
    resourceType: string;
    resourceId: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    return this.repo.save(this.repo.create(data));
  }

  findAll(organizationId: string) {
    return this.repo.find({
      where: { organizationId },
      order: { timestamp: 'DESC' },
      take: 200,
    });
  }

  findByResource(organizationId: string, resourceType: string, resourceId: string) {
    return this.repo.find({
      where: { organizationId, resourceType, resourceId },
      order: { timestamp: 'DESC' },
    });
  }
}
