import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentRequest } from './document-request.entity.js';
import { DocumentRequirement } from './document-requirement.entity.js';
import { DocumentRequestsService } from './document-requests.service.js';
import { DocumentRequestsController } from './document-requests.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentRequest, DocumentRequirement]), AuthModule],
  providers: [DocumentRequestsService],
  controllers: [DocumentRequestsController],
  exports: [DocumentRequestsService],
})
export class DocumentRequestsModule {}
