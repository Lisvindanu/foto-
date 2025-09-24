import { ErrorCodes } from '../types/api';

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export class ValidationResult {
  private errors: ValidationError[] = [];

  addError(code: string, message: string, field?: string) {
    this.errors.push({ code, message, field });
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  get firstError(): ValidationError | null {
    return this.errors[0] || null;
  }

  get allErrors(): ValidationError[] {
    return this.errors;
  }
}

export function validateRequired(value: any, fieldName: string): ValidationResult {
  const result = new ValidationResult();

  if (value === undefined || value === null || value === '') {
    result.addError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `${fieldName} is required`,
      fieldName
    );
  }

  return result;
}

export function validateEmail(email: string): ValidationResult {
  const result = new ValidationResult();

  if (!email) {
    result.addError(ErrorCodes.MISSING_REQUIRED_FIELD, 'Email is required', 'email');
    return result;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    result.addError(ErrorCodes.INVALID_PARAMETERS, 'Invalid email format', 'email');
  }

  return result;
}

export function validateFileSize(size: number, maxSize: number): ValidationResult {
  const result = new ValidationResult();

  if (size > maxSize) {
    result.addError(
      ErrorCodes.FILE_TOO_LARGE,
      `File size ${formatBytes(size)} exceeds limit of ${formatBytes(maxSize)}`,
      'file'
    );
  }

  return result;
}

export function validateMimeType(mimeType: string, allowedTypes: string[]): ValidationResult {
  const result = new ValidationResult();

  if (!allowedTypes.includes(mimeType)) {
    result.addError(
      ErrorCodes.INVALID_FILE_TYPE,
      `File type ${mimeType} is not supported. Allowed types: ${allowedTypes.join(', ')}`,
      'file'
    );
  }

  return result;
}

export function validatePagination(page?: number, limit?: number): ValidationResult {
  const result = new ValidationResult();

  if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
    result.addError(ErrorCodes.INVALID_PARAMETERS, 'Page must be a positive integer', 'page');
  }

  if (limit !== undefined && (limit < 1 || limit > 100 || !Number.isInteger(limit))) {
    result.addError(ErrorCodes.INVALID_PARAMETERS, 'Limit must be between 1 and 100', 'limit');
  }

  return result;
}

export function validateIntensity(intensity?: number): ValidationResult {
  const result = new ValidationResult();

  if (intensity !== undefined && (intensity < 0 || intensity > 1)) {
    result.addError(
      ErrorCodes.INVALID_PARAMETERS,
      'Filter intensity must be between 0 and 1',
      'intensity'
    );
  }

  return result;
}

export function validateQuality(quality?: string): ValidationResult {
  const result = new ValidationResult();

  if (quality !== undefined && !['normal', 'high'].includes(quality)) {
    result.addError(
      ErrorCodes.INVALID_PARAMETERS,
      'Quality must be "normal" or "high"',
      'quality'
    );
  }

  return result;
}

export function validateSortParams(sortBy?: string, sortOrder?: string): ValidationResult {
  const result = new ValidationResult();

  const allowedSortBy = ['created_at', 'updated_at', 'file_size', 'view_count'];
  const allowedSortOrder = ['asc', 'desc'];

  if (sortBy !== undefined && !allowedSortBy.includes(sortBy)) {
    result.addError(
      ErrorCodes.INVALID_PARAMETERS,
      `sortBy must be one of: ${allowedSortBy.join(', ')}`,
      'sortBy'
    );
  }

  if (sortOrder !== undefined && !allowedSortOrder.includes(sortOrder)) {
    result.addError(
      ErrorCodes.INVALID_PARAMETERS,
      `sortOrder must be one of: ${allowedSortOrder.join(', ')}`,
      'sortOrder'
    );
  }

  return result;
}

export function validateSessionToken(token?: string): ValidationResult {
  const result = new ValidationResult();

  if (!token) {
    result.addError(ErrorCodes.INVALID_SESSION, 'Session token is required', 'sessionToken');
    return result;
  }

  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    result.addError(ErrorCodes.INVALID_SESSION, 'Invalid session token format', 'sessionToken');
  }

  return result;
}

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const combined = new ValidationResult();

  for (const result of results) {
    for (const error of result.allErrors) {
      combined.addError(error.code, error.message, error.field);
    }
  }

  return combined;
}

// Utility functions
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}