import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Customer } from '../customers/customer.entity';
import { DocumentRequirement } from '../document-requests/document-requirement.entity';

@Entity('documents')
export class Document {
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

  @Column()
  requirementId: string;

  @ManyToOne(() => DocumentRequirement)
  @JoinColumn({ name: 'requirementId' })
  requirement: DocumentRequirement;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  fileSize: number;

  @Column()
  fileHash: string;

  @Column()
  storagePath: string;

  @Column({ default: false })
  malwareScanPassed: boolean;

  @Column({ nullable: true })
  malwareScannedAt: Date;

  @OneToMany(() => DocumentVersion, v => v.document)
  versions: DocumentVersion[];

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @ManyToOne(() => Document, d => d.versions)
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @Column()
  version: number;

  @Column()
  storagePath: string;

  @Column()
  fileHash: string;

  @Column()
  fileSize: number;

  @Column()
  uploadedBy: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  status: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
