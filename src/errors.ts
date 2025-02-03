// Custom errors
// Constructor error messages may not be sent to the client
// They are managed globally in the error.middleware

export class AuthenticationError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AssertionError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
    this.statusCode = 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class OrderNotFoundError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class OrdersNotFoundError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ExternalAPIError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'ExternalAPIError';
    this.statusCode = 503;
    Error.captureStackTrace(this, this.constructor);
  }
}
