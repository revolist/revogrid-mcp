export class AppError extends Error {
  public readonly statusCode: number;

  public constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string) {
    super(message, 500);
    this.name = 'ConfigurationError';
  }
}

export class AuthorizationError extends AppError {
  public constructor(message = 'Not authorized to access this content.') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}
