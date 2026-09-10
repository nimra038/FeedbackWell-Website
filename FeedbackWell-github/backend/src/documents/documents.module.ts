import { FileSecurityService } from './file-security.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Document, DocumentVersion } from './document.entity';
import { DocumentRequirement } from '../document-requests/document-requirement.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentVersion, DocumentRequirement]), AuthModule],
  providers: [DocumentsService, FileSecurityService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
