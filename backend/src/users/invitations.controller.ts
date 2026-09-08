import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
@Controller('v1/invitations')
export class InvitationsController {
  constructor(private readonly users: UsersService) {}
  @Post('accept')
  accept(@Body() body: { token: string; password: string }) { return this.users.acceptInvite(body.token, body.password); }
}
