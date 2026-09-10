import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../organizations/organization.entity';

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  LOAN_OFFICER = 'loan_officer',
  PROCESSOR = 'processor',
  UNDERWRITER = 'underwriter',
  REVIEWER = 'reviewer',
  READ_ONLY = 'read_only',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INVITED = 'invited',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.LOAN_OFFICER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INVITED })
  status: UserStatus;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true, select: false })
  mfaSecret: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  invitedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
