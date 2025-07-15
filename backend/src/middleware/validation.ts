import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from './errorHandler';

/**
 * Middleware to validate request using express-validator
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined,
    }));

    throw new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR'
    );
  }

  next();
};

/**
 * Custom validation helper functions
 */
export const customValidators = {
  // Check if value is a valid UUID
  isUUID: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  // Check if value is a valid task status
  isValidTaskStatus: (value: string): boolean => {
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    return validStatuses.includes(value);
  },

  // Check if value is a valid priority
  isValidPriority: (value: string): boolean => {
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    return validPriorities.includes(value);
  },

  // Check if value is a valid date
  isValidDate: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  // Check if date is in the future
  isFutureDate: (value: string): boolean => {
    const date = new Date(value);
    return date > new Date();
  },

  // Check if value is a valid tag name
  isValidTagName: (value: string): boolean => {
    // Tag names should be alphanumeric with hyphens and underscores
    const tagRegex = /^[a-zA-Z0-9_-]+$/;
    return tagRegex.test(value) && value.length >= 1 && value.length <= 50;
  },
};
