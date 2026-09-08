import { Entity, PrimaryColumn, Column } from 'typeorm';
@Entity('rate_limit_buckets')
export class RateLimitBucket {
  @PrimaryColumn() key: string;
  @Column({ default: 1 }) count: number;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
}
