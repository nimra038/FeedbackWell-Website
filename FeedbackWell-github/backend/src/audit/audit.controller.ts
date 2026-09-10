import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../auth/permissions';

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
