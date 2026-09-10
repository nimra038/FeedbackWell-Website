import { StaffInvitation } from './users/invitation.entity';
import { RateLimitGuard } from './auth/rate-limit.guard';
import { RateLimitBucket } from './auth/rate-limit-bucket.entity';
import { RequestTemplate } from './templates/template.entity';
import { TemplatesModule } from './templates/templates.module';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AuditInterceptor } from './audit/audit.interceptor';
import { StorageDeletion } from './documents/storage-deletion.entity';
import { Notification } from './notifications/notification.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Organization } from './organizations/organization.entity';
import { User } from './users/user.entity';
import { Customer } from './customers/customer.entity';
import { Application } from './applications/application.entity';
import { DocumentRequest } from './document-requests/document-request.entity';
import { DocumentRequirement } from './document-requests/document-requirement.entity';
import { Document, DocumentVersion } from './documents/document.entity';
import { AuditEvent } from './audit/audit-event.entity';
import { Message } from './messages/message.entity';
import { PortalOtp } from './portal/portal-otp.entity';
import { PortalSession } from './portal/portal-session.entity';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ApplicationsModule } from './applications/applications.module';
import { DocumentRequestsModule } from './document-requests/document-requests.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { MessagesModule } from './messages/messages.module';
import { PortalModule } from './portal/portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        uuidExtension: 'pgcrypto',
        installExtensions: false,
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [
          StorageDeletion,
          StaffInvitation,
          RateLimitBucket,
          RequestTemplate,
          Notification,
          Organization,
          User,
          Customer,
          Application,
          DocumentRequest,
          DocumentRequirement,
          Document,
          DocumentVersion,
          AuditEvent,
          Message,
          PortalOtp,
          PortalSession,
        ],
        synchronize: config.get('NODE_ENV') !== 'production' && config.get('DB_SYNCHRONIZE') !== 'false',
      }),
    }),
    TemplatesModule,
    NotificationsModule,
    OrganizationsModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ApplicationsModule,
    DocumentRequestsModule,
    DocumentsModule,
    AuditModule,
    MessagesModule,
    PortalModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: RateLimitGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
