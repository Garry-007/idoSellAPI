import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  AuthenticationError,
  ExternalAPIError,
  OrderNotFoundError,
  OrdersNotFoundError,
} from '../errors';

export const globalErrorHandler = (
  err: any,
  req?: Request,
  res?: Response,
  next?: NextFunction,
): void => {
  const errorResponse = getErrorResponse(err);

  // log every server error (5xx)
  if ((errorResponse.status >= 500 && errorResponse.status < 600) || !res) {
    console.error('Server error:', err);
  }

  if (res) {
    const { status, ...body } = errorResponse;
    res.status(errorResponse.status).json(body);
  }
};

const getErrorResponse = (err: any) => {
  if (err instanceof ZodError) {
    return {
      status: 400,
      message: 'Validation Error',
      details: err.errors.map((e) => ({
        field: e.path[0],
        message: e.message,
      })),
    };
  }

  if (err instanceof AuthenticationError) {
    return {
      status: err.statusCode,
      message: 'Unauthorized: Invalid credentials provided',
    };
  }

  if (err instanceof ExternalAPIError) {
    return {
      status: err.statusCode,
      message: 'The external service is temporarily unavailable.',
    };
  }

  if (err instanceof OrderNotFoundError) {
    return {
      status: err.statusCode,
      message: 'The order with the given ID was not found.',
    };
  }

  if (err instanceof OrdersNotFoundError) {
    return {
      status: err.statusCode,
      message: 'There are no matching orders based on the provided criteria.',
    };
  }

  // Default error response
  return {
    status: 500,
    message: 'Internal Server Error',
  };
};
