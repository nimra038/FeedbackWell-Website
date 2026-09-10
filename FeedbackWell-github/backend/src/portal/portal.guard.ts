import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PortalService } from './portal.service';

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly portalService: PortalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = auth.replace('Bearer ', '');
    try {
      const payload = this.jwtService.verify(token, { secret: this.config.get('JWT_SECRET') });
      if (payload.type !== 'portal' || payload.portalToken !== req.params.token) throw new UnauthorizedException();
      const request = await this.portalService.resolveRequest(req.params.token);
      if (payload.sub !== request.customerId || payload.requestId !== request.id || payload.organizationId !== request.organizationId) throw new UnauthorizedException();
      req.portal = { ...payload, requestId: request.id, organizationId: request.organizationId };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
