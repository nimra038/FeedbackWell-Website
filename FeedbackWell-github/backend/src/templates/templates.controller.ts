import { Controller, Get, Post, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../auth/permissions';
import { TemplatesService } from './templates.service';
import type { TemplateRequirement } from './template.entity';
@Controller('v1/templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}
  @Get() @RequirePermission('requests.read')
  list(@Request() req: any) { return this.service.list(req.user.organizationId); }
  @Post() @RequirePermission('requests.write')
  create(@Request() req: any, @Body() body: { name: string; requirements: TemplateRequirement[] }) { return this.service.create(req.user.organizationId, body); }
  @Delete(':id') @RequirePermission('requests.write')
  remove(@Request() req: any, @Param('id') id: string) { return this.service.remove(id, req.user.organizationId); }
  @Post(':id/apply/:requestId') @RequirePermission('requests.write')
  apply(@Request() req: any, @Param('id') id: string, @Param('requestId') requestId: string) { return this.service.apply(id, requestId, req.user.organizationId); }
}
