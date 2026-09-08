import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../auth/permissions';

@UseGuards(JwtAuthGuard)
@Controller('v1/messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('request/:requestId')
  @RequirePermission('messages.read')
  getForRequest(@Param('requestId') requestId: string, @Request() req: any) {
    return this.service.getForRequest(requestId, req.user.organizationId, false);
  }

  @Post('request/:requestId')
  @RequirePermission('messages.write')
  send(
    @Param('requestId') requestId: string,
    @Request() req: any,
    @Body() body: { message: string; isInternal?: boolean },
  ) {
    return this.service.sendAsUser(
      req.user.organizationId,
      req.user.id,
      requestId,
      body.message,
      body.isInternal ?? false,
    );
  }
}
