import { queueRequestNotice } from '../notifications/queue.js';
import { StorageDeletion } from './storage-deletion.entity.js';
import { Injectable, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, open } from 'fs/promises';
import { resolve, dirname, sep } from 'path';
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
  ) {}

  async upload(organizationId: string, customerId: string, requirementId: string, uploadedBy: string,
    file: Express.Multer.File, requestId?: string, documentId?: string) {
    const requirement = await this.requirementRepo.findOne({
      where: { id: requirementId, ...(requestId ? { requestId } : {}), request: { organizationId, customerId } }, relations: { request: true },
    });
    if (!requirement) throw new NotFoundException('Requirement not found');
    if (['draft', 'cancelled', 'expired', 'completed'].includes(requirement.request.status)) throw new BadRequestException('This request is not accepting uploads');
    if (!file?.buffer?.length) throw new BadRequestException('A non-empty file is required');
    if (file.buffer.length > Math.min(requirement.maxFileSizeMb || 50, 50) * 1024 * 1024) throw new BadRequestException('File exceeds the requirement size limit');
    const mimeType = await this.security.inspect(file.buffer, file.mimetype);
    const extensions: Record<string, string[]> = { 'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/heic': ['heic'], 'text/plain': ['txt'], 'text/csv': ['csv'], 'application/msword': ['doc'], 'application/vnd.ms-excel': ['xls'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'] };
    if (requirement.acceptedFileTypes?.length && !requirement.acceptedFileTypes.some(t => t === mimeType || extensions[mimeType]?.includes(t.toLowerCase().replace(/^\./, '')))) throw new BadRequestException('This file type is not allowed for this requirement');
    // Fail closed: no file or completed upload is published before a clean scan.
    await this.security.scan(file.buffer);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const storagePath = `uploads/org/${organizationId}/customers/${customerId}/requirements/${requirement.id}/${randomUUID()}`;
    const fullPath = this.localPath(storagePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer, { flag: 'wx' });
    try {
      return await this.docRepo.manager.transaction(async manager => {
        const requestRepo = manager.getRepository(DocumentRequest);
        const currentRequest = await requestRepo.findOne({ where: { id: requirement.requestId, organizationId, customerId }, lock: { mode: 'pessimistic_write' } });
        if (!currentRequest || ['draft', 'cancelled', 'expired', 'completed'].includes(currentRequest.status)) throw new BadRequestException('This request is not accepting uploads');
        const reqRepo = manager.getRepository(DocumentRequirement);
        const current = await reqRepo.findOne({ where: { id: requirement.id }, lock: { mode: 'pessimistic_write' } });
        if (!current) throw new NotFoundException('Requirement not found');
        const docs = manager.getRepository(Document);
        const versions = manager.getRepository(DocumentVersion);
        let doc = documentId ? await docs.findOne({ where: { id: documentId, requirementId, organizationId, customerId } }) : null;
        if (documentId && !doc) throw new NotFoundException('Document not found');
        const duplicate = await docs.findOne({ where: { requirementId, organizationId, fileHash } });
        if (duplicate) throw new BadRequestException('This file has already been uploaded for this requirement');
        if (!doc && await docs.count({ where: { requirementId, organizationId } }) >= (current.maxFiles || 20)) throw new BadRequestException('Maximum number of files reached. Replace an existing file instead.');
        const originalName = file.originalname.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'document';
        if (!doc) doc = docs.create({ organizationId, customerId, requirementId });
        Object.assign(doc, { originalName, mimeType, fileSize: file.buffer.length, fileHash, storagePath, malwareScanPassed: true, malwareScannedAt: new Date() });
        doc = await docs.save(doc);
        const latest = await versions.findOne({ where: { documentId: doc.id }, order: { version: 'DESC' } });
        const version = await versions.save(versions.create({ documentId: doc.id, version: (latest?.version || 0) + 1, storagePath, fileHash, fileSize: file.buffer.length, uploadedBy, status: 'uploaded' }));
        const enoughFiles = await docs.count({ where: { requirementId, organizationId } }) >= current.minFiles;
        await reqRepo.update(requirementId, { status: enoughFiles ? RequirementStatus.UPLOADED : RequirementStatus.MISSING });
        const items = await reqRepo.find({ where: { requestId: currentRequest.id } });
        const allProvided = items.filter(r => r.required).every(r => !['missing', 'rejected', 'needs_replacement'].includes(r.status));
        await requestRepo.update(currentRequest.id, { status: allProvided ? DocumentRequestStatus.UNDER_REVIEW : DocumentRequestStatus.IN_PROGRESS });
        await queueRequestNotice(manager, currentRequest, 'lender', `uploaded:${version.id}`, 'New documents have been uploaded for one of your requests. Sign in to review them.');
        return this.publicDocument(doc);
      });
    } catch (error) { await unlink(fullPath).catch(() => undefined); throw error; }
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
    let handle: Awaited<ReturnType<typeof open>>;
    try { handle = await open(this.localPath(doc.storagePath), 'r'); } catch { throw new NotFoundException('File is unavailable'); }
    return new StreamableFile(handle.createReadStream(), { type: doc.mimeType, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`, length: doc.fileSize });
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
        this.localPath(storagePath);
        await cleanup.save(cleanup.create({ organizationId, storagePath }));
      }
      await manager.getRepository(DocumentVersion).delete({ documentId: id });
      await manager.getRepository(Document).delete({ id, organizationId });
      await manager.getRepository(DocumentRequirement).update(doc.requirementId, { status: RequirementStatus.MISSING });
      await requests.update({ id: requirement.requestId, organizationId }, { status: DocumentRequestStatus.WAITING_ON_CUSTOMER, completedAt: null as unknown as Date });
    });
    return { deleted: true, storageCleanup: 'queued' };
  }
  private localPath(storagePath: string) {
    const root = resolve(process.cwd(), 'uploads');
    const target = resolve(process.cwd(), storagePath);
    if (!target.startsWith(root + sep)) throw new BadRequestException('Invalid storage path');
    return target;
  }
}
