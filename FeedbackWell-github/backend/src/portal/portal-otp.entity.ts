import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('portal_otps')
export class PortalOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  portalToken: string;

  @Column()
  code: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  used: boolean;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
