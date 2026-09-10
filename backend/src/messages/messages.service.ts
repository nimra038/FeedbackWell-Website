import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageSenderType } from './message.entity.js';
import { DocumentRequest } from '../document-requests/document-request.entity.js';
import { requireText } from '../common/input.js';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  // Lender sends message (internal or external)
  async authorizeRequest(requestId: string, organizationId: string, customerId?: string) {
    const request = await this.repo.manager.getRepository(DocumentRequest).findOne({ where: { id: requestId, organizationId, ...(customerId ? { customerId } : {}) } });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async sendAsUser(organizationId: string, senderId: string, requestId: string, body: string, isInternal = false) {
    await this.authorizeRequest(requestId, organizationId);
    requireText(body, 'Message', 10000);
    if (typeof isInternal !== 'boolean') throw new ForbiddenException('Invalid message visibility');
    return this.repo.save(
      this.repo.create({
        organizationId,
        requestId,
        senderId,
        senderType: MessageSenderType.USER,
        body,
        isInternal,
      }),
    );
  }

  // Customer sends message via portal
  async sendAsCustomer(organizationId: string, customerId: string, requestId: string, body: string) {
    await this.authorizeRequest(requestId, organizationId, customerId);
    requireText(body, 'Message', 10000);
    return this.repo.save(
      this.repo.create({
        organizationId,
        requestId,
        senderId: customerId,
        senderType: MessageSenderType.CUSTOMER,
        body,
        isInternal: false,
      }),
    );
  }

  // Get messages for a request — customers never see internal messages
  async getForRequest(requestId: string, organizationId: string, isCustomer = false) {
    await this.authorizeRequest(requestId, organizationId);
    if (isCustomer) {
      return this.repo.find({
        where: { requestId, organizationId, isInternal: false },
        order: { createdAt: 'ASC' },
      });
    }
    return this.repo.find({
      where: { requestId, organizationId },
      order: { createdAt: 'ASC' },
    });
  }

  async markReadByCustomer(requestId: string) {
    await this.repo
      .createQueryBuilder()
      .update(Message)
      .set({ readByCustomer: true })
      .where('requestId = :requestId AND senderType = :type', {
        requestId,
        type: MessageSenderType.USER,
      })
      .execute();
  }
}
