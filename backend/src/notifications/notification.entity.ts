import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() organizationId: string;
  @Column() requestId: string;
  @Column({ unique: true }) dedupeKey: string;
  @Column() recipient: string;
  @Column() senderName: string;
  @Column() subject: string;
  @Column('text') body: string;
  @Index() @Column({ default: 'pending' }) status: string;
  @Column({ default: 0 }) attempts: number;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) nextAttemptAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
