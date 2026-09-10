import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { OrganizationsController } from '../src/organizations/organizations.controller';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { Organization } from '../src/organizations/organization.entity';
import { User } from '../src/users/user.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

// This HTTP suite uses synthetic repositories; it cannot connect to or synchronize a real database.
describe('HTTP tenant and permission boundaries', () => {
  let app: INestApplication;
  const secret = 'integration-test-secret-only';
  const jwt = new JwtService({ secret });
  const staff = [{ id:'owner-a', organizationId:'org-a', role:'owner', status:'active' }, {id:'reader-a',organizationId:'org-a',role:'read_only',status:'active'}, {id:'inactive-a',organizationId:'org-a',role:'owner',status:'inactive'}];
  const token = (id:string) => jwt.sign({sub:id,orgId:'org-a'});
  const repo = { findOne: jest.fn(async ({where}) => where.id==='org-a'?{id:'org-a',name:'Test lender'}:null), update:jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({controllers:[OrganizationsController],providers:[OrganizationsService,JwtAuthGuard,
      {provide:JwtService,useValue:jwt},{provide:ConfigService,useValue:new ConfigService({JWT_SECRET:secret})},
      {provide:getRepositoryToken(Organization),useValue:repo},
      {provide:getRepositoryToken(User),useValue:{findOne:async({where}:{where:{id:string}})=>staff.find(u=>u.id===where.id)}}]}).compile();
    app=module.createNestApplication();await app.init();
  });
  afterAll(async()=>{await app.close();});
  it('requires authentication',()=>request(app.getHttpServer()).get('/v1/organizations/org-a').expect(401));
  it('returns the authenticated organization',()=>request(app.getHttpServer()).get('/v1/organizations/org-a').set('Authorization',`Bearer ${token('owner-a')}`).expect(200).expect({id:'org-a',name:'Test lender'}));
  it('does not reveal another organization',()=>request(app.getHttpServer()).get('/v1/organizations/org-b').set('Authorization',`Bearer ${token('owner-a')}`).expect(404));
  it('does not permit cross-tenant updates',()=>request(app.getHttpServer()).patch('/v1/organizations/org-b').set('Authorization',`Bearer ${token('owner-a')}`).send({name:'changed'}).expect(404));
  it('denies a read-only writer',()=>request(app.getHttpServer()).patch('/v1/organizations/org-a').set('Authorization',`Bearer ${token('reader-a')}`).send({name:'changed'}).expect(403));
  it('revokes access for inactive staff',()=>request(app.getHttpServer()).get('/v1/organizations/org-a').set('Authorization',`Bearer ${token('inactive-a')}`).expect(401));
});
