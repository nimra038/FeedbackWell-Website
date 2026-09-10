import { DocumentRequestsService } from './document-requests.service';
import { BadRequestException } from '@nestjs/common';

describe('Durable request delivery',()=>{
 let record:{id:string;organizationId:string;customerId:string;createdBy:string;portalToken:string;status:string;reminderScheduleHours:number[]};
 const requests={findOne:jest.fn(),update:jest.fn(),manager:{}};
 const requirements={count:jest.fn()};const outbox={create:jest.fn(x=>x),save:jest.fn()};
 const lookup={findOneBy:jest.fn()};
 const manager={getRepository:(entity:{name:string})=>entity.name==='DocumentRequest'?requests:entity.name==='DocumentRequirement'?requirements:entity.name==='Notification'?outbox:lookup};
 const service=new DocumentRequestsService(requests as never,requirements as never);
 const original={host:process.env.SMTP_HOST,from:process.env.SMTP_FROM,url:process.env.PORTAL_BASE_URL};
 beforeEach(()=>{jest.clearAllMocks();process.env.SMTP_HOST='smtp.example.test';process.env.SMTP_FROM='noreply@example.test';process.env.PORTAL_BASE_URL='https://app.example.test';record={id:'request-a',organizationId:'org-a',customerId:'customer-a',createdBy:'user-a',portalToken:'a'.repeat(64),status:'draft',reminderScheduleHours:[24,72,168]};requests.findOne.mockImplementation(async()=>({...record}));requests.update.mockImplementation(async(_id:unknown,patch:object)=>Object.assign(record,patch));requirements.count.mockResolvedValue(1);lookup.findOneBy.mockResolvedValue({name:'Test Lender',email:'demo@example.test'});requests.manager={transaction:(fn:(m:typeof manager)=>unknown)=>fn(manager)};});
 afterAll(()=>{for(const [key,value]of Object.entries({SMTP_HOST:original.host,SMTP_FROM:original.from,PORTAL_BASE_URL:original.url})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 it('queues one request email, three reminders and one escalation without SMTP calls',async()=>{await service.send('request-a','org-a');expect(outbox.save).toHaveBeenCalledTimes(5);expect(record.status).toBe('sent');expect(outbox.save).toHaveBeenCalledWith(expect.objectContaining({dedupeKey:'request-sent:request-a',recipient:'demo@example.test'}));});
 it('does not duplicate delivery jobs when send is retried',async()=>{await service.send('request-a','org-a');await service.send('request-a','org-a');expect(outbox.save).toHaveBeenCalledTimes(5);});
 it('does not send an empty checklist',async()=>{requirements.count.mockResolvedValue(0);await expect(service.send('request-a','org-a')).rejects.toBeInstanceOf(BadRequestException);expect(outbox.save).not.toHaveBeenCalled();});
 it('does not mark sent when delivery configuration is missing',async()=>{delete process.env.SMTP_HOST;await expect(service.send('request-a','org-a')).rejects.toBeInstanceOf(BadRequestException);expect(record.status).toBe('draft');});
});
