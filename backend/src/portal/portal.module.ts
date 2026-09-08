import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalOtp } from './portal-otp.entity';
import { PortalSession } from './portal-session.entity';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { PortalGuard } from './portal.guard';
import { DocumentRequest } from '../document-requests/document-request.entity';
import { DocumentRequirement } from '../document-requests/document-requirement.entity';
import { DocumentsModule } from '../documents/documents.module';
import { MessagesModule } from '../messages/messages.module';

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
