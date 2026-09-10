import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UserRole } from './user.entity.js';
import { RequirePermission } from '../auth/permissions.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }

  @Get()
  @RequirePermission('users.read')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermission('users.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.organizationId);
  }

  @Post('invite')
  @RequirePermission('users.manage')
  invite(
    @Request() req: any,
    @Body() body: { firstName: string; lastName: string; email: string; role: UserRole },
  ) {
    return this.service.invite(req.user.organizationId, body);
  }

  @Patch(':id/role')
  @RequirePermission('users.manage')
  updateRole(@Param('id') id: string, @Request() req: any, @Body() body: { role: UserRole }) {
    return this.service.updateRole(id, req.user.organizationId, body.role);
  }

  @Delete(':id')
  @RequirePermission('users.manage')
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.service.deactivate(id, req.user.organizationId);
  }
}
