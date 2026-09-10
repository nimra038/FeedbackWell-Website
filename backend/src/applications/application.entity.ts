import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity.js';
import { Customer } from '../customers/customer.entity.js';
import { User } from '../users/user.entity.js';

export enum ApplicationStatus {
  DRAFT = 'draft',
  REQUESTED = 'requested',
  COLLECTING = 'collecting',
  DOCUMENTS_IN_REVIEW = 'documents_in_review',
  MISSING_DOCUMENTS = 'missing_documents',
  READY_FOR_REVIEW = 'ready_for_review',
  APPROVED = 'approved',
  DECLINED = 'declined',
  CLOSED = 'closed',
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ nullable: true })
  assignedUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignedUserId' })
  assignedUser: User;

  @Column({ unique: true })
  applicationNumber: string;

  @Column({ nullable: true })
  applicationType: string;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.DRAFT })
  status: ApplicationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
