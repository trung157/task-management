import { body, param, query } from 'express-validator';

/**
 * Validation rules for creating a new tag
 */
export const validateCreateTag = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag name is required and must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Tag name can only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hexadecimal color code (e.g., #FF5733)'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),
];

/**
 * Validation rules for updating a tag
 */
export const validateUpdateTag = [
  param('id')
    .isUUID()
    .withMessage('Tag ID must be a valid UUID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Tag name can only contain letters, numbers, spaces, hyphens, underscores, and dots'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hexadecimal color code (e.g., #FF5733)'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),
];

/**
 * Validation rules for tag ID parameter
 */
export const validateTagId = [
  param('id')
    .isUUID()
    .withMessage('Tag ID must be a valid UUID'),
];

/**
 * Validation rules for tag search and filtering
 */
export const validateTagSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Search query must be less than 50 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'created_at', 'usage_count'])
    .withMessage('Sort by must be one of: name, created_at, usage_count'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
];

/**
 * Validation rules for bulk tag operations
 */
export const validateBulkTagOperation = [
  body('tagIds')
    .isArray({ min: 1 })
    .withMessage('Tag IDs must be a non-empty array'),
  
  body('tagIds.*')
    .isUUID()
    .withMessage('Each tag ID must be a valid UUID'),
];

/**
 * Validation rules for merging tags
 */
export const validateMergeTags = [
  body('sourceTagIds')
    .isArray({ min: 1 })
    .withMessage('Source tag IDs must be a non-empty array'),
  
  body('sourceTagIds.*')
    .isUUID()
    .withMessage('Each source tag ID must be a valid UUID'),
  
  body('targetTagId')
    .isUUID()
    .withMessage('Target tag ID must be a valid UUID'),
];

/**
 * Validation rules for tag statistics query
 */
export const validateTagStats = [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be one of: day, week, month, year'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be an integer between 1 and 50'),
];

/**
 * Validation rules for suggested tags
 */
export const validateSuggestedTags = [
  query('taskTitle')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Task title must be less than 200 characters'),
  
  query('taskDescription')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Task description must be less than 2000 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be an integer between 1 and 20'),
];
