import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('storage_deletions')
export class StorageDeletion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() organizationId: string;
  @Column() storagePath: string;
  @CreateDateColumn() createdAt: Date;
}
