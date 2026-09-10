import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DocumentRequestsService } from './document-requests.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DocumentRequestStatus } from './document-request.entity.js';
import { RequirementStatus } from './document-requirement.entity.js';
import { RequirePermission } from '../auth/permissions.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/requests')
export class DocumentRequestsController {
  constructor(private readonly service: DocumentRequestsService) {}

  @Get()
  @RequirePermission('requests.read')
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermission('requests.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.organizationId);
  }

  @Post()
  @RequirePermission('requests.write')
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.organizationId, req.user.id, body);
  }

  @Patch(':id/send')
  @RequirePermission('requests.write')
  send(@Param('id') id: string, @Request() req: any) {
    return this.service.send(id, req.user.organizationId);
  }

  @Patch(':id/status')
  @RequirePermission('requests.write')
  updateStatus(@Param('id') id: string, @Request() req: any, @Body() body: { status: DocumentRequestStatus }) {
    return this.service.updateStatus(id, req.user.organizationId, body.status);
  }

  // Requirements
  @Get(':id/requirements')
  @RequirePermission('requests.read')
  getRequirements(@Param('id') id: string, @Request() req: any) {
    return this.service.getRequirements(id, req.user.organizationId);
  }

  @Post(':id/requirements')
  @RequirePermission('requests.write')
  addRequirement(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.addRequirement(id, req.user.organizationId, body);
  }

  @Patch('requirements/:requirementId/status')
  @RequirePermission('documents.review')
  updateRequirementStatus(
    @Request() req: any,
    @Param('requirementId') requirementId: string,
    @Body() body: { status: RequirementStatus; reason?: string },
  ) {
    return this.service.updateRequirementStatus(requirementId, req.user.organizationId, body.status, req.user.id, body.reason);
  }

  @Delete('requirements/:requirementId')
  @RequirePermission('requests.write')
  deleteRequirement(@Param('requirementId') requirementId: string, @Request() req: any) {
    return this.service.deleteRequirement(requirementId, req.user.organizationId);
  }
}
