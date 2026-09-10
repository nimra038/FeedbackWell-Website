import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('staff_invitations')
export class StaffInvitation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() organizationId: string;
  @Column() userId: string;
  @Column({ unique: true }) tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
