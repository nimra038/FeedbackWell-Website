import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permissions.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermission('customers.read')
  findAll(@Request() req: any, @Query('search') search?: string) {
    return this.service.findAll(req.user.organizationId, search);
  }

  @Get(':id')
  @RequirePermission('customers.read')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.organizationId);
  }

  @Post()
  @RequirePermission('customers.write')
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.organizationId, body);
  }

  @Patch(':id')
  @RequirePermission('customers.write')
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.update(id, req.user.organizationId, body);
  }

  @Delete(':id')
  @RequirePermission('customers.write')
  archive(@Param('id') id: string, @Request() req: any) {
    return this.service.archive(id, req.user.organizationId);
  }
}
