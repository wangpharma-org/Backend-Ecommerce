import { TransformFnParams } from 'class-transformer';

export const APP_VERSION_PATTERN = /^[0-9.]+$/;

export function trimString({ value }: TransformFnParams) {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

export function normalizePlatform({ value }: TransformFnParams) {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
}

export function normalizeOptionalString({ value }: TransformFnParams) {
  const input: unknown = value;

  if (input === null || input === undefined) {
    return undefined;
  }

  if (typeof input !== 'string') {
    return input;
  }

  const normalized = input.trim();
  return normalized || undefined;
}
