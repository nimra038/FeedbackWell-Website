import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { DocumentRequest } from '../document-requests/document-request.entity';

export enum MessageSenderType {
  USER = 'user',
  CUSTOMER = 'customer',
  SYSTEM = 'system',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  requestId: string;

  @ManyToOne(() => DocumentRequest)
  @JoinColumn({ name: 'requestId' })
  request: DocumentRequest;

  @Column()
  senderId: string;

  @Column({ type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType;

  @Column('text')
  body: string;

  @Column({ default: false })
  isInternal: boolean; // internal notes never visible to customer

  @Column({ default: false })
  readByCustomer: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
