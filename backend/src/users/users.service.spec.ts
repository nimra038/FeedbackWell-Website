import { UsersService } from './users.service.js';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus } from './user.entity.js';
import { createHash } from 'crypto';

describe('Staff invitation and owner protection', () => {
 const token='a'.repeat(64);
 const invitation={id:'invite-a',userId:'user-a',organizationId:'org-a',usedAt:null as Date|null,expiresAt:new Date(Date.now()+3600000)};
 const user={id:'user-a',organizationId:'org-a',status:UserStatus.INVITED,role:UserRole.LOAN_OFFICER};
 const invitations={findOne:jest.fn(),update:jest.fn()};
 const users={findOneBy:jest.fn(),findOne:jest.fn(),update:jest.fn(),manager:{}};
 const jwt={sign:jest.fn(()=> 'signed-token')};
 const manager={getRepository:(entity:{name:string})=>entity.name==='StaffInvitation'?invitations:users};
 const service=new UsersService(users as never,jwt as never);
 beforeEach(()=>{jest.clearAllMocks();invitation.usedAt=null;invitation.expiresAt=new Date(Date.now()+3600000);users.findOneBy.mockResolvedValue(user);users.findOne.mockResolvedValue(user);invitations.findOne.mockImplementation(async()=>({...invitation}));invitations.update.mockImplementation(async(_id:string,patch:object)=>Object.assign(invitation,patch));users.manager={transaction:(fn:(m:typeof manager)=>unknown)=>fn(manager)};});
 it('accepts a single-use hashed invitation and activates only its invited account',async()=>{
   expect(await service.acceptInvite(token,'synthetic-password-123')).toEqual({accessToken:'signed-token'});
   expect(invitations.findOne).toHaveBeenCalledWith(expect.objectContaining({where:{tokenHash:createHash('sha256').update(token).digest('hex')}}));
   expect(users.update).toHaveBeenCalledWith('user-a',expect.objectContaining({status:UserStatus.ACTIVE}));
   expect(jwt.sign).toHaveBeenCalledWith({sub:'user-a',orgId:'org-a'});
   await expect(service.acceptInvite(token,'synthetic-password-123')).rejects.toBeInstanceOf(BadRequestException);
 });
 it('rejects expired invitations',async()=>{invitation.expiresAt=new Date(0);await expect(service.acceptInvite(token,'synthetic-password-123')).rejects.toBeInstanceOf(BadRequestException);expect(users.update).not.toHaveBeenCalled();});
 it('does not reactivate a deactivated account through its old invitation',async()=>{users.findOneBy.mockResolvedValue(null);await expect(service.acceptInvite(token,'synthetic-password-123')).rejects.toBeInstanceOf(BadRequestException);expect(users.update).not.toHaveBeenCalled();});
 it('does not grant ownership through a role change',async()=>{await expect(service.updateRole('user-a','org-a',UserRole.OWNER)).rejects.toBeInstanceOf(ForbiddenException);expect(users.update).not.toHaveBeenCalled();});
 it('does not deactivate the owner',async()=>{users.findOne.mockResolvedValue({...user,role:UserRole.OWNER});await expect(service.deactivate('user-a','org-a')).rejects.toBeInstanceOf(ForbiddenException);expect(users.update).not.toHaveBeenCalled();});
});
