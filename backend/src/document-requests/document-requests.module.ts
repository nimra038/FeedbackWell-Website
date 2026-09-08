import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DocumentRequest } from './document-request.entity';
import { DocumentRequirement } from './document-requirement.entity';
import { DocumentRequestsService } from './document-requests.service';
import { DocumentRequestsController } from './document-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentRequest, DocumentRequirement]), AuthModule],
  providers: [DocumentRequestsService],
  controllers: [DocumentRequestsController],
  exports: [DocumentRequestsService],
})
export class DocumentRequestsModule {}
