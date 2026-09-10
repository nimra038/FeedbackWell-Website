import { FileSecurityService } from './file-security.service.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Document, DocumentVersion } from './document.entity.js';
import { DocumentRequirement } from '../document-requests/document-requirement.entity.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentVersion, DocumentRequirement]), AuthModule],
  providers: [DocumentsService, FileSecurityService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
