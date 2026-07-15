export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'ERROR',
    public errors: FieldError[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad request', errors: FieldError[] = []) {
    return new ApiError(400, message, 'BAD_REQUEST', errors);
  }
  static validation(errors: FieldError[], message = 'Validation failed.') {
    return new ApiError(400, message, 'VALIDATION_ERROR', errors);
  }
  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message = 'Resource already exists.') {
    return new ApiError(409, message, 'CONFLICT');
  }
  static tooMany(message = 'Too many requests. Please try again later.') {
    return new ApiError(429, message, 'RATE_LIMITED');
  }
  static internal(message = 'Something went wrong.') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}
