import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  legal_name: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  brand_color: string;

  @Column({ nullable: true })
  website: string;

  @Column({ default: 'America/New_York' })
  timezone: string;

  @Column({ default: 'US' })
  country: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}