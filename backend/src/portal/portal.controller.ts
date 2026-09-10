import { Controller, Get, Post, Body, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PortalService } from './portal.service.js';
import { PortalGuard } from './portal.guard.js';
import { DocumentsService } from '../documents/documents.service.js';
import { MessagesService } from '../messages/messages.service.js';

@Controller('v1/portal')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly documentsService: DocumentsService,
    private readonly messagesService: MessagesService,
  ) {}

  // Public — no auth needed
  @Get(':token')
  getRequest(@Param('token') token: string) {
    return this.portalService.getRequestByToken(token);
  }

  @Post(':token/otp/send')
  sendOtp(@Param('token') token: string) {
    return this.portalService.sendOtp(token);
  }

  @Post(':token/otp/verify')
  verifyOtp(@Param('token') token: string, @Body() body: { code: string }) {
    return this.portalService.verifyOtp(token, body.code);
  }

  // Protected — portal JWT required
  @UseGuards(PortalGuard)
  @Get(':token/requirements')
  getRequirements(@Param('token') token: string) {
    return this.portalService.getRequirements(token);
  }

  @UseGuards(PortalGuard)
  @Post(':token/upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Param('token') token: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { requirementId: string; documentId?: string },
  ) {
    return this.documentsService.upload(
      req.portal.organizationId,
      req.portal.sub,
      body.requirementId,
      req.portal.sub,
      file,
      req.portal.requestId,
      body.documentId,
    );
  }

  @UseGuards(PortalGuard)
  @Get(':token/messages')
  getMessages(@Param('token') token: string, @Request() req: any) {
    return this.messagesService.getForRequest(req.portal.requestId, req.portal.organizationId, true);
  }

  @UseGuards(PortalGuard)
  @Post(':token/messages')
  sendMessage(
    @Param('token') token: string,
    @Request() req: any,
    @Body() body: { message: string },
  ) {
    return this.messagesService.sendAsCustomer(
      req.portal.organizationId,
      req.portal.sub,
      req.portal.requestId,
      body.message,
    );
  }
}
