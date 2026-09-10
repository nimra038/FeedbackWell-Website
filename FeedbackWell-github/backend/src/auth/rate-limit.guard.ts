import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

/** PostgreSQL counters apply across API instances; raw IPs and portal tokens are not persisted. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const path: string = req.path;
    if (!path.startsWith('/v1/')) return true;
    const sensitive = path.startsWith('/v1/auth/') || path.startsWith('/v1/invitations/') || path.includes('/otp/');
    const group = sensitive ? 'auth' : path.includes('upload') ? 'upload' : 'api';
    const limit = sensitive ? 30 : group === 'upload' ? 60 : 300;
    const key = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(`${req.ip}:${group}`).digest('hex');
    const rows = await this.db.query(`INSERT INTO rate_limit_buckets (key, count, "expiresAt") VALUES ($1, 1, NOW() + INTERVAL '1 minute')
      ON CONFLICT (key) DO UPDATE SET count = CASE WHEN rate_limit_buckets."expiresAt" <= NOW() THEN 1 ELSE rate_limit_buckets.count + 1 END,
      "expiresAt" = CASE WHEN rate_limit_buckets."expiresAt" <= NOW() THEN NOW() + INTERVAL '1 minute' ELSE rate_limit_buckets."expiresAt" END
      RETURNING count`, [key]);
    if (Number(rows[0].count) > limit) {
      context.switchToHttp().getResponse().setHeader('Retry-After', '60');
      throw new HttpException('Too many requests. Please try again in a minute.', 429);
    }
    return true;
  }
}
