import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DocumentRequest } from './document-request.entity.js';

export enum RequirementStatus {
  MISSING = 'missing',
  UPLOADED = 'uploaded',
  UNDER_REVIEW = 'under_review',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEEDS_REPLACEMENT = 'needs_replacement',
  NOT_APPLICABLE = 'not_applicable',
}

@Entity('document_requirements')
export class DocumentRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @ManyToOne(() => DocumentRequest)
  @JoinColumn({ name: 'requestId' })
  request: DocumentRequest;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ default: true })
  required: boolean;

  @Column({ type: 'enum', enum: RequirementStatus, default: RequirementStatus.MISSING })
  status: RequirementStatus;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ type: 'simple-array', nullable: true })
  acceptedFileTypes: string[];

  @Column({ nullable: true })
  maxFileSizeMb: number;

  @Column({ default: 1 })
  minFiles: number;

  @Column({ nullable: true })
  maxFiles: number;

  @Column({ nullable: true })
  instructions: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
