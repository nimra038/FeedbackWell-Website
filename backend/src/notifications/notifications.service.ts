import { DocumentRequest } from '../document-requests/document-request.entity';
import { StorageDeletion } from '../documents/storage-deletion.entity';
import { unlink } from 'fs/promises';
import { resolve, sep } from 'path';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Notification } from './notification.entity';

/** Durable PostgreSQL outbox. SKIP LOCKED permits multiple workers without claiming the same job. */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mailer: Transporter;
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {
    this.mailer = createTransport({ host: config.get('SMTP_HOST'), port: Number(config.get('SMTP_PORT') || 587), secure: Number(config.get('SMTP_PORT')) === 465,
      auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') }, connectionTimeout: 10000, socketTimeout: 15000 });
  }
  onModuleInit() {
    if (this.config.get('NOTIFICATION_WORKER_ENABLED') === 'false') return;
    this.timer = setInterval(() => { void this.deliverBatch(); }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.mailer.close(); }
  private brandedEmail(name: string, body: string) {
    const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const text = escape(body).replace(/https?:\/\/[^\s<]+/g, url => `<a href="${url}" style="color:#2d4a7a">Open your secure portal</a>`).replaceAll('\n', '<br>');
    return `<div style="background:#f4f6fa;padding:32px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:32px"><h2 style="color:#1a2744">${escape(name)}</h2><p style="color:#475569;line-height:1.7">${text}</p><hr style="border:0;border-top:1px solid #e2e8f0;margin-top:28px"><p style="font-size:12px;color:#94a3b8">Powered by FeedbackWell. Please do not email sensitive documents as attachments.</p></div></div>`;
  }
  private async cleanupStorage() {
    for (let i = 0; i < 20; i++) {
      const processed = await this.db.transaction(async manager => {
        const repo = manager.getRepository(StorageDeletion);
        const job = await repo.createQueryBuilder('job').orderBy('job.createdAt', 'ASC').setLock('pessimistic_write').setOnLocked('skip_locked').getOne();
        if (!job) return false;
        const root = resolve(process.cwd(), 'uploads', 'org', job.organizationId);
        const target = resolve(process.cwd(), job.storagePath);
        if (!target.startsWith(root + sep)) throw new Error('Storage cleanup path is outside its organization');
        try { await unlink(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        await repo.delete(job.id);
        return true;
      });
      if (!processed) break;
    }
  }
  async deliverBatch() {
    if (this.running) return;
    this.running = true;
    try {
      await this.db.query(`DELETE FROM rate_limit_buckets WHERE "expiresAt" < NOW() - INTERVAL '1 hour'`);
      await this.cleanupStorage();
      if (!this.config.get('SMTP_HOST')) return;
      for (let i = 0; i < 10; i++) {
        const processed = await this.db.transaction(async manager => {
          const repo = manager.getRepository(Notification);
          const job = await repo.createQueryBuilder('job').where('job.status = :status', { status: 'pending' })
            .andWhere('job.nextAttemptAt <= :now', { now: new Date() }).orderBy('job.createdAt', 'ASC')
            .setLock('pessimistic_write').setOnLocked('skip_locked').getOne();
          if (!job) return false;
          if (job.dedupeKey.startsWith('reminder:') || job.dedupeKey.startsWith('escalation:')) {
            const request = await manager.getRepository(DocumentRequest).findOneBy({ id: job.requestId, organizationId: job.organizationId });
            if (!request || !['sent', 'opened', 'in_progress', 'waiting_on_customer'].includes(request.status) || (request.portalExpiresAt && request.portalExpiresAt.getTime() <= Date.now())) {
              await repo.update(job.id, { status: 'cancelled' });
              return true;
            }
          }
          try {
            await this.mailer.sendMail({ from: { name: job.senderName, address: this.config.getOrThrow<string>('SMTP_FROM') },
              to: job.recipient, subject: job.subject, text: job.body, html: this.brandedEmail(job.senderName, job.body), messageId: `<${job.id}@feedbackwell.notifications>` });
            await repo.update(job.id, { status: 'sent', sentAt: new Date(), attempts: job.attempts + 1 });
          } catch {
            const attempts = job.attempts + 1;
            await repo.update(job.id, { attempts, status: attempts >= 5 ? 'failed' : 'pending', nextAttemptAt: new Date(Date.now() + 60000 * 2 ** attempts) });
            this.logger.warn(`Notification ${job.id} delivery failed; attempt ${attempts}`);
          }
          return true;
        });
        if (!processed) break;
      }
    } catch { this.logger.error('Notification worker failed; jobs remain in the outbox'); }
    finally { this.running = false; }
  }
}
