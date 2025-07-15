/**
 * JWT Configuration Module
 * 
 * Handles JWT token configuration and validation.
 * Provides utilities for token management and security.
 */

import jwt from 'jsonwebtoken';
import config from './config';
import { logger } from '../utils/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * Generate JWT access token
 */
export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      algorithm: config.jwt.algorithm as jwt.Algorithm,
    });
  } catch (error) {
    logger.error('Failed to generate access token', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
      algorithm: config.jwt.algorithm as jwt.Algorithm,
    });
  } catch (error) {
    logger.error('Failed to generate refresh token', error);
    throw new Error('Refresh token generation failed');
  }
};

/**
 * Generate token pair (access + refresh tokens)
 */
export const generateTokenPair = (payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
  };
};

/**
 * Verify JWT access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algorithm as jwt.Algorithm],
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    logger.error('Access token verification failed', error);
    throw new Error('Token verification failed');
  }
};

/**
 * Verify JWT refresh token
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      algorithms: [config.jwt.algorithm as jwt.Algorithm],
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    logger.error('Refresh token verification failed', error);
    throw new Error('Refresh token verification failed');
  }
};

/**
 * Decode JWT token without verification (for inspection)
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    logger.error('Token decode failed', error);
    return null;
  }
};

/**
 * Get token expiration timestamp
 */
export const getTokenExpiration = (token: string): Date | null => {
  try {
    const decoded = decodeToken(token);
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  } catch (error) {
    logger.error('Failed to get token expiration', error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const expiration = getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  } catch (error) {
    return true;
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Validate JWT configuration
 */
export const validateJWTConfig = (): void => {
  const errors: string[] = [];

  if (!config.jwt.secret) {
    errors.push('JWT_SECRET is required');
  }

  if (!config.jwt.refreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required');
  }

  if (config.jwt.secret === config.jwt.refreshSecret) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (config.server.env === 'production') {
    if (config.jwt.secret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
    
    if (config.jwt.refreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
    }
  }

  if (errors.length > 0) {
    logger.error('JWT configuration validation failed', { errors });
    throw new Error(`JWT configuration invalid: ${errors.join(', ')}`);
  }
};

/**
 * Get safe JWT configuration info (for logging)
 */
export const getJWTInfo = (): Record<string, any> => {
  return {
    algorithm: config.jwt.algorithm,
    accessTokenExpiry: config.jwt.expiresIn,
    refreshTokenExpiry: config.jwt.refreshExpiresIn,
    secretLength: config.jwt.secret.length,
    refreshSecretLength: config.jwt.refreshSecret.length,
  };
};
