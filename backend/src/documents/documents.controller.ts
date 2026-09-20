import {
  Controller, Post, Get, Delete, Param, UseGuards,
  Request, Body, Header,
} from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
@Post('upload/prepare')
  @RequirePermission('documents.upload')
  prepareUpload(
    @Request() req: any,
    @Body() body: { customerId: string; requestId: string; requirementId: string; originalName: string; contentType: string; documentId?: string },
  ) {
    return this.service.prepareDirectUpload(
      req.user.organizationId,
      body.customerId,
      body.requestId,
      body.requirementId,
      body.originalName,
      body.contentType,
      body.documentId,
    );
  }

  @Post('upload/complete')
  @RequirePermission('documents.upload')
  completeUpload(
    @Request() req: any,
    @Body() body: { customerId: string; requestId: string; requirementId: string; storagePath: string; originalName: string; uploadIntent: string; documentId?: string },
  ) {
    return this.service.finalizeDirectUpload(
      req.user.organizationId,
      body.customerId,
      body.requestId,
      body.requirementId,
      req.user.id,
      body.storagePath,
      body.originalName,
      body.uploadIntent,
      body.documentId,
    );
  }
  @Get('requirement/:requirementId')
  @RequirePermission('documents.read')
  findByRequirement(@Param('requirementId') requirementId: string, @Request() req: any) {
    return this.service.findByRequirement(requirementId, req.user.organizationId);
  }

  @Get('requirement/:requirementId/files')
  @RequirePermission('documents.read')
  list(@Param('requirementId') id: string, @Request() req: any) {
    return this.service.listByRequirement(id, req.user.organizationId);
  }

  @Get(':id/content')
  @RequirePermission('documents.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  content(@Param('id') id: string, @Request() req: any) {
    return this.service.content(id, req.user.organizationId);
  }

  @Get(':id/versions')
  @RequirePermission('documents.read')
  getVersions(@Param('id') id: string, @Request() req: any) {
    return this.service.getVersions(id, req.user.organizationId);
  }

  @Get(':id')
  @RequirePermission('documents.read')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.publicDocument(await this.service.findById(id, req.user.organizationId));
  }

  @Delete(':id')
  @RequirePermission('documents.delete')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.delete(id, req.user.organizationId);
  }
}
