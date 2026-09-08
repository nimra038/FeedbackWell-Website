import { queueRequestNotice } from '../notifications/queue';
import { User } from '../users/user.entity';
import { Document, DocumentVersion } from '../documents/document.entity';
import { Message, MessageSenderType } from '../messages/message.entity';
import { ApplicationStatus } from '../applications/application.entity';
import { Notification } from '../notifications/notification.entity';
import { Organization } from '../organizations/organization.entity';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Customer } from '../customers/customer.entity';
import { Application } from '../applications/application.entity';
import { pickFields, assertEnum, requireText } from '../common/input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DocumentRequest, DocumentRequestStatus } from './document-request.entity';
import { DocumentRequirement, RequirementStatus } from './document-requirement.entity';

@Injectable()
export class DocumentRequestsService {
  constructor(
    @InjectRepository(DocumentRequest) private readonly requestRepo: Repository<DocumentRequest>,
    @InjectRepository(DocumentRequirement) private readonly requirementRepo: Repository<DocumentRequirement>,
  ) {}

  async findAll(organizationId: string) {
    const requests = await this.requestRepo.find({
      where: { organizationId },
      relations: { customer: true, creator: true, application: { assignedUser: true } },
      order: { createdAt: 'DESC' },
    });
    if (!requests.length) return [];
    const requirements = await this.requirementRepo.find({ where: { requestId: In(requests.map(r => r.id)) } });
    return requests.map(request => {
      const items = requirements.filter(r => r.requestId === request.id);
      const completed = items.filter(r => [RequirementStatus.ACCEPTED, RequirementStatus.NOT_APPLICABLE].includes(r.status)).length;
      return { ...request, progress: { total: items.length, completed, missing: items.filter(r => r.required && [RequirementStatus.MISSING, RequirementStatus.REJECTED, RequirementStatus.NEEDS_REPLACEMENT].includes(r.status)).length }, assignedUser: request.application?.assignedUser || null };
    });
  }

  async findById(id: string, organizationId: string) {
    const request = await this.requestRepo.findOne({
      where: { id, organizationId },
      relations: { customer: true, creator: true, application: true },
    });
    if (!request) throw new NotFoundException('Document request not found');
    return request;
  }

  async findByToken(portalToken: string) {
    const request = await this.requestRepo.findOne({
      where: { portalToken },
      relations: { customer: true, organization: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async create(organizationId: string, createdBy: string, dto: Partial<DocumentRequest>) {
    requireText(dto.title, 'Title');
    requireText(dto.customerId, 'Customer');
    const customer = await this.requestRepo.manager.getRepository(Customer).findOne({ where: { id: dto.customerId, organizationId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (dto.applicationId) {
      requireText(dto.applicationId, 'Application');
      const application = await this.requestRepo.manager.getRepository(Application).findOne({ where: { id: dto.applicationId, organizationId, customerId: dto.customerId } });
      if (!application) throw new NotFoundException('Application not found');
    }
    const fields = pickFields(dto, ['title', 'description', 'customerId', 'applicationId', 'dueDate', 'reminderScheduleHours']);
    if (fields.reminderScheduleHours !== undefined && (!Array.isArray(fields.reminderScheduleHours) || fields.reminderScheduleHours.length > 10 || fields.reminderScheduleHours.some(h => !Number.isInteger(h) || h < 1 || h > 720))) throw new BadRequestException('Reminder hours must be whole numbers between 1 and 720, with at most 10 reminders');
    if (!fields.dueDate) delete fields.dueDate;
    else if (typeof fields.dueDate !== 'string' || !Number.isFinite(Date.parse(fields.dueDate))) throw new BadRequestException('Invalid due date');
    if (!fields.applicationId) delete fields.applicationId;
    const portalToken = randomBytes(32).toString('hex');
    return this.requestRepo.save(
      this.requestRepo.create({ ...fields, organizationId, createdBy, portalToken, status: DocumentRequestStatus.DRAFT }),
    );
  }

  async send(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.PORTAL_BASE_URL) {
      throw new BadRequestException('Request email delivery is not configured. Contact your administrator.');
    }
    const base = new URL(process.env.PORTAL_BASE_URL);
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new BadRequestException('Portal URL must use HTTPS');
    await this.requestRepo.manager.transaction(async manager => {
      const repo = manager.getRepository(DocumentRequest);
      const request = await repo.findOne({ where: { id, organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== DocumentRequestStatus.DRAFT) return;
      const customer = await manager.getRepository(Customer).findOneBy({ id: request.customerId, organizationId });
      const organization = await manager.getRepository(Organization).findOneBy({ id: organizationId });
      if (!customer?.email || !organization) throw new BadRequestException('A customer email is required');
      const count = await manager.getRepository(DocumentRequirement).count({ where: { requestId: id } });
      if (!count) throw new BadRequestException('Add at least one document requirement before sending');
      const link = new URL(`/portal/${request.portalToken}`, base).toString();
      const outbox = manager.getRepository(Notification);
      await outbox.save(outbox.create({ organizationId, requestId: id, dedupeKey: `request-sent:${id}`,
        recipient: customer.email, senderName: organization.name, subject: `${organization.name} requested documents`,
        body: `You have a new document request from ${organization.name}. Open your secure portal to verify your email and view the checklist: ${link}\n\nPlease do not send documents as email attachments.` }));
      const sentAt = new Date();
      for (const hours of new Set(request.reminderScheduleHours || [24, 72, 168])) {
        await outbox.save(outbox.create({ organizationId, requestId: id, dedupeKey: `reminder:${id}:${hours}`,
          recipient: customer.email, senderName: organization.name, subject: `Document reminder from ${organization.name}`,
          body: `Your document request is still waiting for your response. Open your secure portal to see what is needed: ${link}`,
          nextAttemptAt: new Date(sentAt.getTime() + hours * 3600000) }));
      }
      const creator = await manager.getRepository(User).findOneBy({ id: request.createdBy, organizationId });
      if (creator?.email) await outbox.save(outbox.create({ organizationId, requestId: id, dedupeKey: `escalation:${id}`,
        recipient: creator.email, senderName: organization.name, subject: 'A document request needs your attention',
        body: 'A request has been waiting for documents for seven days. Sign in to your FeedbackWell workspace to follow up.',
        nextAttemptAt: new Date(sentAt.getTime() + 168 * 3600000) }));
      await repo.update({ id, organizationId }, { status: DocumentRequestStatus.SENT, sentAt, portalExpiresAt: new Date(sentAt.getTime() + 30 * 86400000) });
    });
    return this.findById(id, organizationId);
  }

  async updateStatus(id: string, organizationId: string, status: DocumentRequestStatus) {
    assertEnum(status, DocumentRequestStatus);
    await this.findById(id, organizationId);
    if (status === DocumentRequestStatus.COMPLETED) {
      const requirements = await this.requirementRepo.find({ where: { requestId: id } });
      if (!requirements.length || requirements.some(r => r.required && ![RequirementStatus.ACCEPTED, RequirementStatus.NOT_APPLICABLE].includes(r.status))) {
        throw new BadRequestException('All required documents must be accepted before completion');
      }
    }
    const update: Partial<DocumentRequest> = { status };
    if (status === DocumentRequestStatus.COMPLETED) update.completedAt = new Date();
    await this.requestRepo.update(id, update);
    return this.findById(id, organizationId);
  }

  // Requirements
  async getRequirements(requestId: string, organizationId: string) {
    await this.findById(requestId, organizationId);
    const requirements = await this.requirementRepo.find({ where: { requestId }, order: { createdAt: 'ASC' } });
    const documents = await this.requestRepo.manager.getRepository(Document).find({ where: { organizationId, requirement: { requestId } } });
    return requirements.map(requirement => ({ ...requirement, documents: documents.filter(doc => doc.requirementId === requirement.id).map(doc => ({ id: doc.id, originalName: doc.originalName, mimeType: doc.mimeType, fileSize: doc.fileSize, malwareScanPassed: doc.malwareScanPassed })) }));
  }

  async addRequirement(requestId: string, organizationId: string, dto: Partial<DocumentRequirement>) {
    await this.findById(requestId, organizationId);
    requireText(dto.name, 'Requirement name');
    if (dto.minFiles !== undefined && (!Number.isInteger(dto.minFiles) || dto.minFiles < 1 || dto.minFiles > 20)) throw new BadRequestException('Minimum files must be between 1 and 20');
    if (dto.maxFiles !== undefined && (!Number.isInteger(dto.maxFiles) || dto.maxFiles < (dto.minFiles || 1) || dto.maxFiles > 20)) throw new BadRequestException('Maximum files must be between the minimum and 20');
    if (dto.maxFileSizeMb !== undefined && (typeof dto.maxFileSizeMb !== 'number' || dto.maxFileSizeMb < 1 || dto.maxFileSizeMb > 50)) throw new BadRequestException('File size limit must be between 1 and 50 MB');
    if (dto.acceptedFileTypes !== undefined && (!Array.isArray(dto.acceptedFileTypes) || dto.acceptedFileTypes.some(t => typeof t !== 'string'))) throw new BadRequestException('Accepted file types must be a list of strings');
    if (dto.required !== undefined && typeof dto.required !== 'boolean') throw new BadRequestException('Required must be true or false');
    const fields = pickFields(dto, ['name', 'description', 'category', 'required', 'dueDate', 'acceptedFileTypes', 'maxFileSizeMb', 'minFiles', 'maxFiles', 'instructions']);
    return this.requirementRepo.manager.transaction(async manager => {
      const requests = manager.getRepository(DocumentRequest);
      const request = await requests.findOne({ where: { id: requestId, organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!request || [DocumentRequestStatus.COMPLETED, DocumentRequestStatus.CANCELLED, DocumentRequestStatus.EXPIRED].includes(request.status)) throw new BadRequestException('This request cannot accept new requirements');
      const repo = manager.getRepository(DocumentRequirement);
      const saved = await repo.save(repo.create({ ...fields, requestId, status: RequirementStatus.MISSING }));
      if (request.status !== DocumentRequestStatus.DRAFT) {
        await requests.update(request.id, { status: DocumentRequestStatus.WAITING_ON_CUSTOMER });
        await queueRequestNotice(manager, request, 'customer', `requirement:${saved.id}`, 'Your lender has requested an additional document. Open your portal to view the updated checklist.');
      }
      return saved;
    });
  }

  async findRequirement(requirementId: string, organizationId: string) {
    const requirement = await this.requirementRepo.findOne({ where: { id: requirementId, request: { organizationId } }, relations: { request: true } });
    if (!requirement) throw new NotFoundException('Requirement not found');
    return requirement;
  }

  async updateRequirementStatus(requirementId: string, organizationId: string, status: RequirementStatus, reviewerId?: string, reason?: string) {
    assertEnum(status, RequirementStatus);
    const requirement = await this.findRequirement(requirementId, organizationId);
    if ([RequirementStatus.REJECTED, RequirementStatus.NEEDS_REPLACEMENT].includes(status)) requireText(reason, 'Replacement reason', 2000);
    return this.requirementRepo.manager.transaction(async manager => {
      const requests = manager.getRepository(DocumentRequest);
      const request = await requests.findOne({ where: { id: requirement.requestId, organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!request || [DocumentRequestStatus.CANCELLED, DocumentRequestStatus.EXPIRED].includes(request.status)) throw new BadRequestException('This request cannot be reviewed');
      const docs = await manager.getRepository(Document).find({ where: { requirementId, organizationId } });
      if (status === RequirementStatus.ACCEPTED && (docs.length < requirement.minFiles || docs.some(doc => !doc.malwareScanPassed))) {
        throw new BadRequestException('Upload the required number of clean documents before accepting');
      }
      await manager.getRepository(DocumentRequirement).update(requirementId, { status });
      for (const doc of docs) {
        const versions = manager.getRepository(DocumentVersion);
        const latest = await versions.findOne({ where: { documentId: doc.id }, order: { version: 'DESC' } });
        if (latest) await versions.update(latest.id, { status, reviewedBy: reviewerId, reviewedAt: new Date() });
      }
      if (reason && reviewerId) {
        const messages = manager.getRepository(Message);
        await messages.save(messages.create({ organizationId, requestId: request.id, senderId: reviewerId, senderType: MessageSenderType.USER, isInternal: false, body: `${requirement.name}: ${reason}` }));
      }
      const items = await manager.getRepository(DocumentRequirement).find({ where: { requestId: request.id } });
      const required = items.filter(item => item.required);
      const complete = required.length > 0 && required.every(item => [RequirementStatus.ACCEPTED, RequirementStatus.NOT_APPLICABLE].includes(item.status));
      const missing = required.some(item => [RequirementStatus.MISSING, RequirementStatus.REJECTED, RequirementStatus.NEEDS_REPLACEMENT].includes(item.status));
      const nextStatus = complete ? DocumentRequestStatus.COMPLETED : missing ? DocumentRequestStatus.WAITING_ON_CUSTOMER : DocumentRequestStatus.UNDER_REVIEW;
      await requests.update(request.id, { status: nextStatus, completedAt: complete ? new Date() : null as unknown as Date });
      if (request.applicationId && complete) {
        const pending = await requests.count({ where: { applicationId: request.applicationId, organizationId, status: Not(In([DocumentRequestStatus.COMPLETED, DocumentRequestStatus.CANCELLED])) } });
        if (!pending) await manager.getRepository(Application).update({ id: request.applicationId, organizationId, status: Not(In([ApplicationStatus.APPROVED, ApplicationStatus.DECLINED, ApplicationStatus.CLOSED])) }, { status: ApplicationStatus.READY_FOR_REVIEW });
      }
      if ([RequirementStatus.REJECTED, RequirementStatus.NEEDS_REPLACEMENT].includes(status)) await queueRequestNotice(manager, request, 'customer', `review:${randomUUID()}`, 'A document needs a replacement. Open your portal to read your lender?s instructions.');
      if (complete && request.status !== DocumentRequestStatus.COMPLETED) {
        await queueRequestNotice(manager, request, 'customer', `completed:${randomUUID()}`, 'Your document request is complete. Thank you for providing your documents.');
        await queueRequestNotice(manager, request, 'lender', `ready:${randomUUID()}`, 'A document request is complete and ready for your review.');
      }
      return manager.getRepository(DocumentRequirement).findOneBy({ id: requirementId });
    });
  }

  async deleteRequirement(requirementId: string, organizationId: string) {
    const requirement = await this.findRequirement(requirementId, organizationId);
    if (requirement.request.status !== DocumentRequestStatus.DRAFT) throw new BadRequestException('Mark sent requirements not applicable to preserve their history');
    await this.requirementRepo.delete(requirementId);
  }
}
