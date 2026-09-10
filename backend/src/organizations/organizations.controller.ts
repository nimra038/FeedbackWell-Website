import { Controller, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RequirePermission } from '../auth/permissions.js';
import { OrganizationsService } from './organizations.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get(':id')
  @RequirePermission('settings.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.organizationId);
  }

  @Patch(':id')
  @RequirePermission('settings.manage')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.update(id, req.user.organizationId, body);
  }
}
