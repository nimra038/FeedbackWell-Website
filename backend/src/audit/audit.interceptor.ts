import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { mergeMap } from 'rxjs';
import { AuditService } from './audit.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService, private readonly jwt: JwtService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(mergeMap(async result => {
      let actor = req.user ? { organizationId: req.user.organizationId, id: req.user.id, type: 'user' as const } : req.portal ? { organizationId: req.portal.organizationId, id: req.portal.sub, type: 'customer' as const } : null;
      if (!actor && result?.accessToken) {
        const payload = this.jwt.verify(result.accessToken);
        actor = { organizationId: payload.orgId || payload.organizationId, id: payload.sub, type: payload.type === 'portal' ? 'customer' : 'user' };
      }
      if (!actor || req.path.startsWith('/v1/audit')) return result;
      const viewedDocument = req.method === 'GET' && req.path.startsWith('/v1/documents/');
      if (req.method === 'GET' && !viewedDocument) return result;
      const resourceType = req.portal ? 'request' : req.path.split('/')[2] || 'unknown';
      const resourceId = req.portal?.requestId || req.params.id || req.params.requirementId || req.params.requestId || result?.id || actor.id;
      const action = viewedDocument ? (req.path.endsWith('/content') ? 'document.downloaded' : 'document.viewed') : `${resourceType}.${req.method.toLowerCase()}`;
      await this.audit.log({ organizationId: actor.organizationId, actorId: actor.id, actorType: actor.type, action, resourceType, resourceId,
        ipAddress: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 500), metadata: { method: req.method, ...(typeof req.body?.status === 'string' ? { status: req.body.status } : {}) } });
      return result;
    }));
  }
}
