import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/user.entity';
import { hasPermission, PERMISSION_KEY, Permission } from '../permissions';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = auth.replace('Bearer ', '');
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.type === 'portal' || typeof payload.sub !== 'string' || typeof payload.orgId !== 'string') throw new UnauthorizedException();
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || user.status !== UserStatus.ACTIVE || user.organizationId !== payload.orgId) throw new UnauthorizedException();
      req.user = user;
    } catch {
      throw new UnauthorizedException();
    }
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (permission && !hasPermission(req.user.role, permission)) throw new ForbiddenException('You do not have permission to perform this action');
    return true;
  }
}
