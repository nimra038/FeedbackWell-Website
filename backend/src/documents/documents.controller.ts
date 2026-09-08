import {
  Controller, Post, Get, Delete, Param, UseGuards,
  Request, UseInterceptors, UploadedFile, Body, Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../auth/permissions';

@UseGuards(JwtAuthGuard)
@Controller('v1/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload')
  @RequirePermission('documents.upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { customerId: string; requirementId: string; documentId?: string },
  ) {
    return this.service.upload(
      req.user.organizationId,
      body.customerId,
      body.requirementId,
      req.user.id,
      file,
      undefined,
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
