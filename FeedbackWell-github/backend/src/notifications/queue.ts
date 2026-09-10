import { EntityManager } from 'typeorm';
import { Notification } from './notification.entity';
import { DocumentRequest } from '../document-requests/document-request.entity';
import { Customer } from '../customers/customer.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';

export async function queueRequestNotice(manager: EntityManager, request: DocumentRequest, target: 'customer' | 'lender', eventKey: string, message: string) {
  const recipient = target === 'customer'
    ? await manager.getRepository(Customer).findOneBy({ id: request.customerId, organizationId: request.organizationId })
    : await manager.getRepository(User).findOneBy({ id: request.createdBy, organizationId: request.organizationId });
  const organization = await manager.getRepository(Organization).findOneBy({ id: request.organizationId });
  if (!recipient?.email || !organization) return;
  const base = process.env.PORTAL_BASE_URL;
  const link = base ? new URL(target === 'customer' ? `/portal/${request.portalToken}` : `/requests/${request.id}`, base).toString() : '';
  const repo = manager.getRepository(Notification);
  await repo.save(repo.create({ organizationId: request.organizationId, requestId: request.id, dedupeKey: eventKey, recipient: recipient.email, senderName: organization.name,
    subject: `Document request update from ${organization.name}`, body: `${message}\n\n${link ? `Open your secure workspace: ${link}` : 'Sign in to FeedbackWell to view this update.'}` }));
}
