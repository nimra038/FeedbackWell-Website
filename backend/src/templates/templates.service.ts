import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestTemplate, TemplateRequirement } from './template.entity';
import { DocumentRequest, DocumentRequestStatus } from '../document-requests/document-request.entity';
import { DocumentRequirement, RequirementStatus } from '../document-requests/document-requirement.entity';
import { requireText } from '../common/input';

const definitions: [string, string, string[]][] = [
  ['builtin-mortgage', 'Residential mortgage - purchase', ['Government-issued ID', 'Co-borrower ID', 'Last 2 years W-2', 'Last 2 years tax returns', 'Last 2 months bank statements', 'Last 30 days pay stubs', 'Purchase contract', 'Homeowners insurance']],
  ['builtin-business', 'Business loan - standard documentation', ['Business formation documents', 'Business tax returns', 'Personal tax returns', 'Business bank statements', 'Personal financial statement', 'Profit & loss statement', 'Balance sheet', 'Accounts receivable', 'Accounts payable', 'Business debt schedule']],
  ['builtin-tax', 'Accounting & tax preparation', ['Government-issued ID', 'Previous tax return', 'Income statements', 'Business income and expenses', 'Supporting deductions']],
];
const builtins = definitions.map(([id, name, names]) => ({ id, name, builtIn: true, requirements: names.map(name => ({ name, required: true, minFiles: 1, maxFiles: 10 })) }));
@Injectable()
export class TemplatesService {
  constructor(private readonly db: DataSource) {}
  async list(organizationId: string) { return [...builtins, ...await this.db.getRepository(RequestTemplate).find({ where: { organizationId }, order: { createdAt: 'DESC' } })]; }
  async create(organizationId: string, input: { name: string; requirements: TemplateRequirement[] }) {
    requireText(input.name, 'Template name', 200);
    if (!Array.isArray(input.requirements) || !input.requirements.length || input.requirements.length > 100) throw new BadRequestException('A template must contain between 1 and 100 requirements');
    const requirements = input.requirements.map(r => {
      requireText(r.name, 'Requirement name');
      const minFiles = r.minFiles ?? 1; const maxFiles = r.maxFiles ?? 10;
      if (!Number.isInteger(minFiles) || !Number.isInteger(maxFiles) || minFiles < 1 || maxFiles < minFiles || maxFiles > 20) throw new BadRequestException('Invalid file count limits');
      return { name: r.name.trim(), instructions: typeof r.instructions === 'string' ? r.instructions.slice(0, 5000) : '', required: r.required !== false, minFiles, maxFiles };
    });
    const repo = this.db.getRepository(RequestTemplate);
    return repo.save(repo.create({ organizationId, name: input.name.trim(), requirements }));
  }
  async remove(id: string, organizationId: string) {
    const repo = this.db.getRepository(RequestTemplate);
    const template = await repo.findOneBy({ id, organizationId });
    if (!template) throw new NotFoundException('Template not found');
    await repo.delete({ id, organizationId });
    return { deleted: true };
  }
  async apply(id: string, requestId: string, organizationId: string) {
    const template = builtins.find(t => t.id === id) || await this.db.getRepository(RequestTemplate).findOneBy({ id, organizationId });
    if (!template) throw new NotFoundException('Template not found');
    return this.db.transaction(async manager => {
      const request = await manager.getRepository(DocumentRequest).findOne({ where: { id: requestId, organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== DocumentRequestStatus.DRAFT) throw new BadRequestException('Apply templates before sending a request');
      const repo = manager.getRepository(DocumentRequirement);
      if (await repo.count({ where: { requestId } })) throw new BadRequestException('This request already has requirements. Add individual requirements instead.');
      return repo.save(template.requirements.map(r => repo.create({ name: r.name, instructions: 'instructions' in r ? r.instructions : '', required: r.required, minFiles: r.minFiles, maxFiles: r.maxFiles, requestId, status: RequirementStatus.MISSING })));
    });
  }
}
