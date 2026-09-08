import { BadRequestException } from '@nestjs/common';

/** Only explicitly editable scalar fields may reach TypeORM. Relations and IDs are server-owned. */
export function pickFields<T extends object>(input: Partial<T>, fields: readonly (keyof T)[]): Partial<T> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid request body');
  const result: Partial<T> = {};
  for (const key of fields) {
    if (input[key] !== undefined) result[key] = input[key];
  }
  return result;
}

export function assertEnum<T extends string>(value: unknown, values: Record<string, T>): asserts value is T {
  if (!Object.values(values).includes(value as T)) throw new BadRequestException('Invalid status or role');
}

export function requireText(value: unknown, field: string, max = 500): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BadRequestException(`${field} is required and must be at most ${max} characters`);
  }
}
