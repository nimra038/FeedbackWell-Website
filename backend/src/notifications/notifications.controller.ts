import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service.js';

@Controller('v1/internal/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('run')
  async run(@Headers('authorization') authorization?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    await this.notifications.deliverBatch();
    return { ok: true };
  }
}
