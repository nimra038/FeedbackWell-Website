import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { StaffInvitation } from './users/invitation.entity.js';
import { RateLimitGuard } from './auth/rate-limit.guard.js';
import { RateLimitBucket } from './auth/rate-limit-bucket.entity.js';
import { RequestTemplate } from './templates/template.entity.js';
import { AuditInterceptor } from './audit/audit.interceptor.js';
import { StorageDeletion } from './documents/storage-deletion.entity.js';
import { Notification } from './notifications/notification.entity.js';
import { Organization } from './organizations/organization.entity.js';
import { User } from './users/user.entity.js';
import { Customer } from './customers/customer.entity.js';
import { Application } from './applications/application.entity.js';
import { DocumentRequest } from './document-requests/document-request.entity.js';
import { DocumentRequirement } from './document-requests/document-requirement.entity.js';
import {
  Document,
  DocumentVersion,
} from './documents/document.entity.js';
import { AuditEvent } from './audit/audit-event.entity.js';
import { Message } from './messages/message.entity.js';
import { PortalOtp } from './portal/portal-otp.entity.js';
import { PortalSession } from './portal/portal-session.entity.js';
import { TemplatesModule } from './templates/templates.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { DocumentRequestsModule } from './document-requests/document-requests.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AuditModule } from './audit/audit.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { PortalModule } from './portal/portal.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        type: 'postgres',

        uuidExtension: 'pgcrypto',
        installExtensions: false,

        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),

        ssl: {
          rejectUnauthorized: false,
        },

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

        synchronize:
          config.get<string>('NODE_ENV') !== 'production' &&
          config.get<string>('DB_SYNCHRONIZE') !== 'false',
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

  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
