import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalOtp } from './portal-otp.entity.js';
import { PortalSession } from './portal-session.entity.js';
import { PortalService } from './portal.service.js';
import { PortalController } from './portal.controller.js';
import { PortalGuard } from './portal.guard.js';
import { DocumentRequest } from '../document-requests/document-request.entity.js';
import { DocumentRequirement } from '../document-requests/document-requirement.entity.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { MessagesModule } from '../messages/messages.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortalOtp, PortalSession, DocumentRequest, DocumentRequirement]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    DocumentsModule,
    MessagesModule,
  ],
  providers: [PortalService, PortalGuard],
  controllers: [PortalController],
})
export class PortalModule {}
