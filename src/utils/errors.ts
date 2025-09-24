import type { ApiResponse, ApiError } from '../types/api';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createErrorResponse(
  error: AppError | Error,
  statusCode?: number
): { response: ApiResponse; status: number } {
  if (error instanceof AppError) {
    return {
      response: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        },
        timestamp: new Date().toISOString()
      },
      status: error.statusCode
    };
  }

  // Generic error
  return {
    response: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      },
      timestamp: new Date().toISOString()
    },
    status: statusCode || 500
  };
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  pagination?: any
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    pagination,
    timestamp: new Date().toISOString()
  };
}

// Common error creators
export const Errors = {
  InvalidSession: (message = 'Session token is invalid or expired') =>
    new AppError('INVALID_SESSION', message, 401),

  SessionExpired: (message = 'Session has expired') =>
    new AppError('SESSION_EXPIRED', message, 401),

  MissingRequiredField: (field: string) =>
    new AppError('MISSING_REQUIRED_FIELD', `Required field is missing: ${field}`, 400),

  InvalidFileType: (mimeType: string) =>
    new AppError('INVALID_FILE_TYPE', `File type not supported: ${mimeType}`, 400),

  FileTooLarge: (maxSize: string) =>
    new AppError('FILE_TOO_LARGE', `File size exceeds limit: ${maxSize}`, 413),

  QuotaExceeded: (message = 'Storage quota exceeded') =>
    new AppError('QUOTA_EXCEEDED', message, 507),

  PhotoNotFound: (id?: number) =>
    new AppError('PHOTO_NOT_FOUND', `Photo ${id ? `with id ${id}` : ''} not found or access denied`, 404),

  FilterNotFound: (id?: number) =>
    new AppError('FILTER_NOT_FOUND', `Filter ${id ? `with id ${id}` : ''} not found`, 404),

  UserNotFound: (id?: number) =>
    new AppError('USER_NOT_FOUND', `User ${id ? `with id ${id}` : ''} not found`, 404),

  RateLimitExceeded: (message = 'Too many requests, try again later') =>
    new AppError('RATE_LIMIT_EXCEEDED', message, 429),

  MaxPhotosExceeded: (max: number) =>
    new AppError('MAX_PHOTOS_EXCEEDED', `Maximum of ${max} photos per user exceeded`, 400),

  ProcessingFailed: (reason?: string) =>
    new AppError('PROCESSING_FAILED', `Image processing failed${reason ? `: ${reason}` : ''}`, 500),

  StorageError: (message = 'File storage operation failed') =>
    new AppError('STORAGE_ERROR', message, 500),

  DatabaseError: (message = 'Database operation failed') =>
    new AppError('DATABASE_ERROR', message, 500),

  InvalidParameters: (message = 'Invalid request parameters') =>
    new AppError('INVALID_PARAMETERS', message, 400),

  InternalServerError: (message = 'An unexpected error occurred') =>
    new AppError('INTERNAL_SERVER_ERROR', message, 500)
};

// Error handler middleware function
export function handleError(error: unknown): { response: ApiResponse; status: number } {
  console.error('Error occurred:', error);

  if (error instanceof AppError) {
    return createErrorResponse(error);
  }

  if (error instanceof Error) {
    // Log the actual error for debugging
    console.error('Unexpected error:', error.stack);
    return createErrorResponse(Errors.InternalServerError());
  }

  return createErrorResponse(Errors.InternalServerError());
}