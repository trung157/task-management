/**
 * Authentication Types
 * 
 * Shared type definitions for authentication and authorization
 */

// User interface for authenticated requests
export interface User {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: Date;
  iat?: number;
  exp?: number;
}

// Token information interface
export interface TokenInfo {
  type: 'access' | 'refresh';
  issuedAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  remainingTime?: number;
}

// Authentication options interface
export interface AuthOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  validateUser?: boolean;
  allowExpiredGracePeriod?: number; // milliseconds
}

// Role definitions
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  MODERATOR: 'moderator',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Permission definitions
export const PERMISSIONS = {
  // User permissions
  READ_PROFILE: 'read:profile',
  UPDATE_PROFILE: 'update:profile',
  DELETE_PROFILE: 'delete:profile',
  
  // Task permissions
  CREATE_TASK: 'create:task',
  READ_TASK: 'read:task',
  UPDATE_TASK: 'update:task',
  DELETE_TASK: 'delete:task',
  
  // Admin permissions
  MANAGE_USERS: 'manage:users',
  MANAGE_SYSTEM: 'manage:system',
  VIEW_ANALYTICS: 'view:analytics',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
