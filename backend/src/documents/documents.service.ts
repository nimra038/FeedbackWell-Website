import { queueRequestNotice } from '../notifications/queue.js';
import { StorageDeletion } from './storage-deletion.entity.js';
import { Injectable, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { put, get, del } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { Readable } from 'stream';
import { Document, DocumentVersion } from './document.entity.js';
import { RequirementStatus, DocumentRequirement } from '../document-requests/document-requirement.entity.js';
import { DocumentRequest, DocumentRequestStatus } from '../document-requests/document-request.entity.js';
import { FileSecurityService } from './file-security.service.js';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly docRepo: Repository<Document>,
    @InjectRepository(DocumentVersion) private readonly versionRepo: Repository<DocumentVersion>,
    @InjectRepository(DocumentRequirement) private readonly requirementRepo: Repository<DocumentRequirement>,
    private readonly security: FileSecurityService,
    private readonly jwt: JwtService,
  ) {}

  private async streamToBuffer(stream: ReadableStream<Uint8Array>, maximumSizeInBytes: number) {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of Readable.fromWeb(stream as any)) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;

      if (total > maximumSizeInBytes) {
        throw new BadRequestException('File exceeds the requirement size limit');
      }

      chunks.push(buffer);
    }

    if (!total) throw new BadRequestException('A non-empty file is required');

    return Buffer.concat(chunks, total);
  }
  private ensureAllowedFileType(requirement: DocumentRequirement, mimeType: string) {
    const extensions: Record<string, string[]> = {
      'application/pdf': ['pdf'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/heic': ['heic'],
      'text/plain': ['txt'],
      'text/csv': ['csv'],
      'application/msword': ['doc'],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    };

    if (
      requirement.acceptedFileTypes?.length &&
      !requirement.acceptedFileTypes.some(
        t => t === mimeType || extensions[mimeType]?.includes(t.toLowerCase().replace(/^\./, '')),
      )
    ) {
      throw new BadRequestException('This file type is not allowed for this requirement');
    }
  }
  async prepareDirectUpload(
    organizationId: string,
    customerId: string,
    requestId: string,
    requirementId: string,
    originalName: string,
    contentType: string,
    documentId?: string,
  ) {
    const requirement = await this.requirementRepo.findOne({
      where: {
        id: requirementId,
        requestId,
        request: { organizationId, customerId },
      },
      relations: { request: true },
    });

    if (!requirement) throw new NotFoundException('Requirement not found');

    if (['draft', 'cancelled', 'expired', 'completed'].includes(requirement.request.status)) {
      throw new BadRequestException('This request is not accepting uploads');
    }

    if (typeof originalName !== 'string' || !originalName.trim()) {
      throw new BadRequestException('A valid filename is required');
    }

    if (typeof contentType !== 'string' || !contentType.trim()) {
      throw new BadRequestException('A valid content type is required');
    }

    if (documentId) {
      const existing = await this.docRepo.findOne({
        where: { id: documentId, requirementId, organizationId, customerId },
      });
      if (!existing) throw new NotFoundException('Document not found');
    } else {
      const count = await this.docRepo.count({ where: { requirementId, organizationId } });
      if (count >= (requirement.maxFiles || 20)) {
        throw new BadRequestException('Maximum number of files reached. Replace an existing file instead.');
      }
    }

    const extension = originalName.match(/(\.[A-Za-z0-9]{1,10})$/)?.[1]?.toLowerCase() || '';
    const pathname = `org/${organizationId}/customers/${customerId}/requirements/${requirementId}/${randomUUID()}${extension}`;
    const maximumSizeInBytes = Math.min(requirement.maxFileSizeMb || 50, 50) * 1024 * 1024;

    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      maximumSizeInBytes,
      allowedContentTypes: [contentType],
      validUntil: Date.now() + 10 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    const uploadIntent = this.jwt.sign(
        {
          type: 'upload-intent',
          organizationId,
          customerId,
          requestId,
          requirementId,
          pathname,
          originalName,
          documentId: documentId || null,
        },
        { expiresIn: '10m' },
      );

      return {
        pathname,
        clientToken,
        maximumSizeInBytes,
        uploadIntent,
      };
  }
  async finalizeDirectUpload(
    organizationId: string,
    customerId: string,
    requestId: string,
    requirementId: string,
    uploadedBy: string,
    storagePath: string,
    originalName: string,
    uploadIntent: string,
    documentId?: string,
  ) {
    let intent: any;

    try {
      intent = this.jwt.verify(uploadIntent);
    } catch {
      throw new BadRequestException('Upload authorization is invalid or expired');
    }

    if (
      intent?.type !== 'upload-intent' ||
      intent.organizationId !== organizationId ||
      intent.customerId !== customerId ||
      intent.requestId !== requestId ||
      intent.requirementId !== requirementId ||
      intent.pathname !== storagePath ||
      intent.originalName !== originalName ||
      (intent.documentId || null) !== (documentId || null)
    ) {
      throw new BadRequestException('Upload authorization does not match this file');
    }

    const requirement = await this.requirementRepo.findOne({
      where: {
        id: requirementId,
        requestId,
        request: { organizationId, customerId },
      },
      relations: { request: true },
    });

    if (!requirement) throw new NotFoundException('Requirement not found');

    if (['draft', 'cancelled', 'expired', 'completed'].includes(requirement.request.status)) {
      throw new BadRequestException('This request is not accepting uploads');
    }

    const blob = await get(storagePath, { access: 'private' }).catch(() => null);
    if (!blob?.stream) throw new NotFoundException('Uploaded file is unavailable');

    const maximumSizeInBytes = Math.min(requirement.maxFileSizeMb || 50, 50) * 1024 * 1024;
    const buffer = await this.streamToBuffer(blob.stream as any, maximumSizeInBytes);
    const mimeType = await this.security.inspect(buffer, intent.contentType);
    this.ensureAllowedFileType(requirement, mimeType);
    await this.security.scan(buffer);

    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const safeOriginalName =
      originalName.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'document';

    try {
      return await this.docRepo.manager.transaction(async manager => {
        const requestRepo = manager.getRepository(DocumentRequest);
        const requirementRepo = manager.getRepository(DocumentRequirement);
        const docs = manager.getRepository(Document);
        const versions = manager.getRepository(DocumentVersion);

        const currentRequest = await requestRepo.findOne({
          where: { id: requestId, organizationId, customerId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !currentRequest ||
          ['draft', 'cancelled', 'expired', 'completed'].includes(currentRequest.status)
        ) {
          throw new BadRequestException('This request is not accepting uploads');
        }

        const current = await requirementRepo.findOne({
          where: { id: requirementId, requestId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!current) throw new NotFoundException('Requirement not found');

        let doc = documentId
          ? await docs.findOne({
              where: { id: documentId, requirementId, organizationId, customerId },
            })
          : null;

        if (documentId && !doc) throw new NotFoundException('Document not found');

        const duplicate = await docs.findOne({
          where: { requirementId, organizationId, fileHash },
        });

        if (duplicate && duplicate.id !== documentId) {
          throw new BadRequestException(
            'This file has already been uploaded for this requirement',
          );
        }

        if (
          !doc &&
          (await docs.count({ where: { requirementId, organizationId } })) >=
            (current.maxFiles || 20)
        ) {
          throw new BadRequestException(
            'Maximum number of files reached. Replace an existing file instead.',
          );
        }

        if (!doc) {
          doc = docs.create({ organizationId, customerId, requirementId });
        }

        Object.assign(doc, {
          originalName: safeOriginalName,
          mimeType,
          fileSize: buffer.length,
          fileHash,
          storagePath,
          malwareScanPassed: true,
          malwareScannedAt: new Date(),
        });

        doc = await docs.save(doc);

        const latest = await versions.findOne({
          where: { documentId: doc.id },
          order: { version: 'DESC' },
        });

        const version = await versions.save(
          versions.create({
            documentId: doc.id,
            version: (latest?.version || 0) + 1,
            storagePath,
            fileHash,
            fileSize: buffer.length,
            uploadedBy,
            status: 'uploaded',
          }),
        );

        const enoughFiles =
          (await docs.count({ where: { requirementId, organizationId } })) >=
          current.minFiles;

        await requirementRepo.update(requirementId, {
          status: enoughFiles ? RequirementStatus.UPLOADED : RequirementStatus.MISSING,
        });

        const items = await requirementRepo.find({
          where: { requestId: currentRequest.id },
        });

        const allProvided = items
          .filter(item => item.required)
          .every(
            item =>
              !['missing', 'rejected', 'needs_replacement'].includes(item.status),
          );

        await requestRepo.update(currentRequest.id, {
          status: allProvided
            ? DocumentRequestStatus.UNDER_REVIEW
            : DocumentRequestStatus.IN_PROGRESS,
        });

        await queueRequestNotice(
          manager,
          currentRequest,
          'lender',
          `uploaded:${version.id}`,
          'New documents have been uploaded for one of your requests. Sign in to review them.',
        );

        return this.publicDocument(doc);
      });
    } catch (error) {
      await del(storagePath).catch(() => undefined);
      throw error;
    }
  }
  publicDocument(doc: Document) {
    const { storagePath: _path, ...metadata } = doc;
    return metadata;
  }
  async listByRequirement(requirementId: string, organizationId: string) {
    const requirement = await this.requirementRepo.findOne({ where: { id: requirementId, request: { organizationId } } });
    if (!requirement) throw new NotFoundException('Requirement not found');
    const docs = await this.docRepo.find({ where: { requirementId, organizationId }, order: { createdAt: 'ASC' } });
    return docs.map(doc => this.publicDocument(doc));
  }
  async findByRequirement(requirementId: string, organizationId: string) {
    const docs = await this.listByRequirement(requirementId, organizationId);
    if (!docs.length) return null;
    return { ...docs[0], versions: await this.getVersions(docs[0].id, organizationId) };
  }
  async getVersions(documentId: string, organizationId: string) {
    await this.findById(documentId, organizationId);
    const versions = await this.versionRepo.find({ where: { documentId }, order: { version: 'DESC' } });
    return versions.map(({ storagePath: _path, ...version }) => version);
  }
  async findById(id: string, organizationId: string) {
    const doc = await this.docRepo.findOne({ where: { id, organizationId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
  async content(id: string, organizationId: string) {
    const doc = await this.findById(id, organizationId);
    if (!doc.malwareScanPassed) throw new BadRequestException('This file has not passed malware scanning');
    const blob = await get(doc.storagePath, { access: 'private' }).catch(() => null);
    if (!blob?.stream) throw new NotFoundException('File is unavailable');
    const stream = Readable.fromWeb(blob.stream as any);
    return new StreamableFile(stream, { type: doc.mimeType, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`, length: doc.fileSize });
  }
  async delete(id: string, organizationId: string) {
    const doc = await this.findById(id, organizationId);
    await this.docRepo.manager.transaction(async manager => {
      const requests = manager.getRepository(DocumentRequest);
      const requirement = await manager.getRepository(DocumentRequirement).findOneBy({ id: doc.requirementId });
      if (!requirement) throw new NotFoundException('Requirement not found');
      await requests.findOne({ where: { id: requirement.requestId, organizationId }, lock: { mode: 'pessimistic_write' } });
      const versions = await manager.getRepository(DocumentVersion).find({ where: { documentId: id } });
      const cleanup = manager.getRepository(StorageDeletion);
      for (const storagePath of new Set([doc.storagePath, ...versions.map(v => v.storagePath)])) {
        await cleanup.save(cleanup.create({ organizationId, storagePath }));
      }
      await manager.getRepository(DocumentVersion).delete({ documentId: id });
      await manager.getRepository(Document).delete({ id, organizationId });
      await manager.getRepository(DocumentRequirement).update(doc.requirementId, { status: RequirementStatus.MISSING });
      await requests.update({ id: requirement.requestId, organizationId }, { status: DocumentRequestStatus.WAITING_ON_CUSTOMER, completedAt: null as unknown as Date });
    });
    return { deleted: true, storageCleanup: 'queued' };
  }
}
















