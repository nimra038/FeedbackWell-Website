import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationStatus } from './application.entity';
import { RequirePermission } from '../auth/permissions';

@UseGuards(JwtAuthGuard)
@Controller('v1/applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get()
  @RequirePermission('applications.read')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermission('applications.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.organizationId);
  }

  @Post()
  @RequirePermission('applications.write')
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermission('applications.write')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.update(id, req.user.organizationId, body);
  }

  @Patch(':id/status')
  @RequirePermission('applications.write')
  updateStatus(@Param('id') id: string, @Request() req: any, @Body() body: { status: ApplicationStatus }) {
    return this.service.updateStatus(id, req.user.organizationId, body.status);
  }
}
