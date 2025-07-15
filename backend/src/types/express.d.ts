/**
 * Extended Express type definitions
 * Extends Express Request interface to include user authentication information
 */

import { User, TokenInfo } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      tokenInfo?: TokenInfo;
    }
  }
}

export {};

export {};
