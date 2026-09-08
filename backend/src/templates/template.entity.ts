import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
export interface TemplateRequirement { name: string; instructions?: string; required: boolean; minFiles: number; maxFiles: number }
@Entity('request_templates')
export class RequestTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() organizationId: string;
  @Column() name: string;
  @Column('jsonb') requirements: TemplateRequirement[];
  @CreateDateColumn() createdAt: Date;
}
