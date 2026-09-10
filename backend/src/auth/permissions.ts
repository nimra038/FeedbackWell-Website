import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity.js';

export const PERMISSION_KEY = 'permission';
export type Permission = 'customers.read' | 'customers.write' | 'applications.read' | 'applications.write' |
  'requests.read' | 'requests.write' | 'documents.read' | 'documents.upload' | 'documents.delete' |
  'documents.review' | 'messages.read' | 'messages.write' | 'users.read' | 'users.manage' |
  'settings.read' | 'settings.manage' | 'audit.read';
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);

const read: Permission[] = ['customers.read', 'applications.read', 'requests.read', 'documents.read', 'messages.read', 'settings.read'];
const officer: Permission[] = [...read, 'customers.write', 'applications.write', 'requests.write', 'documents.upload', 'documents.review', 'messages.write'];
const reviewer: Permission[] = [...read, 'documents.review', 'messages.write'];
const permissions: Record<UserRole, readonly Permission[]> = {
  owner: [...officer, 'documents.delete', 'users.read', 'users.manage', 'settings.manage', 'audit.read'],
  admin: [...officer, 'documents.delete', 'users.read', 'users.manage', 'settings.manage', 'audit.read'],
  manager: [...officer, 'documents.delete', 'users.read', 'audit.read'],
  loan_officer: officer,
  processor: reviewer,
  underwriter: reviewer,
  reviewer,
  read_only: read,
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissions[role]?.includes(permission) ?? false;
}
