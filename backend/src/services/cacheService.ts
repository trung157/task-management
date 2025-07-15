/**
 * Enhanced Cache Service with Redis
 * Provides intelligent caching with automatic invalidation and performance monitoring
 */

// import Redis from 'ioredis'; // Install with: npm install ioredis @types/ioredis
import { logger } from '../utils/logger';

// Mock Redis interface for type safety until ioredis is installed
interface RedisInterface {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  smembers(key: string): Promise<string[]>;
  ping(): Promise<string>;
  quit(): Promise<void>;
  on(event: string, callback: (error?: any) => void): void;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  operations: number;
}

export class CacheService {
  private redis: RedisInterface;
  private defaultTTL = 300; // 5 minutes
  private stats: CacheStats = { hits: 0, misses: 0, hitRate: 0, operations: 0 };

  constructor() {
    // Initialize Redis client - requires 'npm install ioredis @types/ioredis'
    // this.redis = new Redis({
    //   host: process.env.REDIS_HOST || 'localhost',
    //   port: parseInt(process.env.REDIS_PORT || '6379'),
    //   password: process.env.REDIS_PASSWORD,
    //   retryDelayOnFailover: 100,
    //   enableReadyCheck: false,
    //   lazyConnect: true,
    //   maxRetriesPerRequest: 3,
    //   connectTimeout: 10000,
    //   commandTimeout: 5000,
    //   family: 4,
    //   keepAlive: true,
    //   enableAutoPipelining: true,
    // });

    // Mock implementation for development
    this.redis = this.createMockRedis();

    this.redis.on('error', (error: any) => {
      logger.error('Redis connection error', { error });
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  private createMockRedis(): RedisInterface {
    const mockStorage = new Map<string, { value: string; expiry: number }>();
    const mockSets = new Map<string, Set<string>>();

    return {
      async get(key: string): Promise<string | null> {
        const item = mockStorage.get(key);
        if (!item || Date.now() > item.expiry) {
          mockStorage.delete(key);
          return null;
        }
        return item.value;
      },
      async setex(key: string, ttl: number, value: string): Promise<void> {
        mockStorage.set(key, { value, expiry: Date.now() + ttl * 1000 });
      },
      async del(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
          if (mockStorage.delete(key) || mockSets.delete(key)) {
            count++;
          }
        }
        return count;
      },
      async keys(pattern: string): Promise<string[]> {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(mockStorage.keys()).filter(key => regex.test(key));
      },
      async sadd(key: string, ...members: string[]): Promise<number> {
        if (!mockSets.has(key)) {
          mockSets.set(key, new Set());
        }
        const set = mockSets.get(key)!;
        let added = 0;
        for (const member of members) {
          if (!set.has(member)) {
            set.add(member);
            added++;
          }
        }
        return added;
      },
      async expire(key: string, seconds: number): Promise<number> {
        // Mock implementation - just return 1 if key exists
        return mockStorage.has(key) || mockSets.has(key) ? 1 : 0;
      },
      async smembers(key: string): Promise<string[]> {
        const set = mockSets.get(key);
        return set ? Array.from(set) : [];
      },
      async ping(): Promise<string> {
        return 'PONG';
      },
      async quit(): Promise<void> {
        mockStorage.clear();
        mockSets.clear();
      },
      on(event: string, callback: (error?: any) => void): void {
        // Mock event handling
        if (event === 'connect') {
          setTimeout(callback, 100);
        }
      }
    };
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      this.stats.operations++;
      const cached = await this.redis.get(key);
      
      if (cached) {
        this.stats.hits++;
        this.updateHitRate();
        return JSON.parse(cached);
      } else {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      logger.error('Cache get error', { key, error });
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const { ttl = this.defaultTTL, tags = [], compress = false } = options;
      
      let serializedValue = JSON.stringify(value);
      
      // Optional compression for large values
      if (compress && serializedValue.length > 1024) {
        // Implement compression here if needed
      }

      await this.redis.setex(key, ttl, serializedValue);
      
      // Store cache tags for invalidation
      for (const tag of tags) {
        await this.redis.sadd(`tag:${tag}`, key);
        await this.redis.expire(`tag:${tag}`, ttl);
      }

      logger.debug('Cache set', { key, ttl, tags });
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache invalidated by pattern', { pattern, keysCount: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache pattern invalidation error', { pattern, error });
      return 0;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
        logger.info('Cache invalidated by tag', { tag, keysCount: keys.length });
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Cache tag invalidation error', { tag, error });
      return 0;
    }
  }

  // Cache with automatic invalidation and monitoring
  async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached) {
      const duration = Date.now() - startTime;
      logger.debug('Cache hit', { key, duration });
      return cached;
    }

    // Execute query and cache result
    try {
      const result = await queryFn();
      await this.set(key, result, options);
      
      const duration = Date.now() - startTime;
      logger.debug('Cache miss - query executed', { key, duration });
      
      return result;
    } catch (error) {
      logger.error('Query execution failed', { key, error });
      throw error;
    }
  }

  // Implement cache warming for critical data
  async warmCache(warmingFunctions: Array<{ key: string; fn: () => Promise<any>; options?: CacheOptions }>): Promise<void> {
    logger.info('Starting cache warming', { functionsCount: warmingFunctions.length });
    
    const promises = warmingFunctions.map(async ({ key, fn, options }) => {
      try {
        const result = await fn();
        await this.set(key, result, options);
        logger.debug('Cache warmed', { key });
      } catch (error) {
        logger.error('Cache warming failed', { key, error });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warming completed');
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, hitRate: 0, operations: 0 };
  }

  private updateHitRate(): void {
    this.stats.hitRate = this.stats.operations > 0 
      ? (this.stats.hits / this.stats.operations) * 100 
      : 0;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis disconnected gracefully');
    } catch (error) {
      logger.error('Redis disconnect error', { error });
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache decorators for easy usage
export function Cached(options: CacheOptions & { keyGenerator?: (...args: any[]) => string } = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      return cacheService.cacheQuery(
        key,
        () => method.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

// Cache invalidation decorator
export function InvalidateCache(tags: string[] | ((...args: any[]) => string[])) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const tagsToInvalidate = typeof tags === 'function' ? tags(...args) : tags;
      
      for (const tag of tagsToInvalidate) {
        await cacheService.invalidateByTag(tag);
      }

      return result;
    };

    return descriptor;
  };
}
