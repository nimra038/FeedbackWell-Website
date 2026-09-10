import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.js';

@UseGuards(JwtAuthGuard)
@RequirePermission('audit.read')
@Controller('v1/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':resourceType/:resourceId')
  findByResource(
    @Request() req: any,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.service.findByResource(req.user.organizationId, resourceType, resourceId);
  }
}
