/**
 * Embeddings Cache
 * Redis-based caching layer for embeddings to reduce API calls and costs
 */

import Redis from 'ioredis';
import { createLogger } from '@devflow/common';
import crypto from 'crypto';
import { metricsCollector } from '../metrics/metrics-collector';

const logger = createLogger('EmbeddingsCache');

export interface EmbeddingsCacheConfig {
  redisUrl?: string;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  ttl?: number;
  keyPrefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export class EmbeddingsCache {
  private redis: Redis;
  private ttl: number;
  private keyPrefix: string;
  private stats: { hits: number; misses: number };

  constructor(config: EmbeddingsCacheConfig = {}) {
    // Initialize Redis client
    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl);
    } else {
      this.redis = new Redis({
        host: config.redisHost || 'localhost',
        port: config.redisPort || 6379,
        password: config.redisPassword,
      });
    }

    this.ttl = config.ttl || 86400; // 24 hours default
    this.keyPrefix = config.keyPrefix || 'emb:';
    this.stats = { hits: 0, misses: 0 };

    logger.info('Embeddings Cache initialized', {
      ttl: this.ttl,
      keyPrefix: this.keyPrefix,
    });

    // Handle Redis connection errors
    this.redis.on('error', (error) => {
      logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  /**
   * Generate hash key for text
   */
  private hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Get embedding from cache
   */
  async get(text: string): Promise<number[] | null> {
    const startTime = Date.now();

    try {
      const key = this.keyPrefix + this.hash(text);
      const cached = await this.redis.get(key);
      const latency = Date.now() - startTime;

      if (cached) {
        this.stats.hits++;
        metricsCollector.recordCacheHit(latency);
        logger.debug('Cache hit', { key, latency });
        return JSON.parse(cached);
      }

      this.stats.misses++;
      metricsCollector.recordCacheMiss(latency);
      logger.debug('Cache miss', { key, latency });
      return null;
    } catch (error) {
      const latency = Date.now() - startTime;
      metricsCollector.recordCacheMiss(latency);
      logger.error('Failed to get from cache', error as Error);
      return null; // Fail gracefully
    }
  }

  /**
   * Set embedding in cache
   */
  async set(text: string, embedding: number[]): Promise<void> {
    try {
      const key = this.keyPrefix + this.hash(text);
      await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
      logger.debug('Cache set', { key });
    } catch (error) {
      logger.error('Failed to set cache', error as Error);
      // Fail gracefully - caching is not critical
    }
  }

  /**
   * Get multiple embeddings from cache
   */
  async mget(texts: string[]): Promise<(number[] | null)[]> {
    const startTime = Date.now();

    try {
      const keys = texts.map((t) => this.keyPrefix + this.hash(t));
      const cached = await this.redis.mget(...keys);
      const latency = Date.now() - startTime;

      return cached.map((c) => {
        if (c) {
          this.stats.hits++;
          metricsCollector.recordCacheHit(latency / texts.length);
          return JSON.parse(c);
        }
        this.stats.misses++;
        metricsCollector.recordCacheMiss(latency / texts.length);
        return null;
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      texts.forEach(() => metricsCollector.recordCacheMiss(latency / texts.length));
      logger.error('Failed to mget from cache', error as Error);
      return texts.map(() => null); // Fail gracefully
    }
  }

  /**
   * Set multiple embeddings in cache
   */
  async mset(items: Array<{ text: string; embedding: number[] }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      items.forEach(({ text, embedding }) => {
        const key = this.keyPrefix + this.hash(text);
        pipeline.setex(key, this.ttl, JSON.stringify(embedding));
      });

      await pipeline.exec();
      logger.debug('Cache mset', { count: items.length });
    } catch (error) {
      logger.error('Failed to mset cache', error as Error);
      // Fail gracefully
    }
  }

  /**
   * Delete embedding from cache
   */
  async delete(text: string): Promise<void> {
    try {
      const key = this.keyPrefix + this.hash(text);
      await this.redis.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Failed to delete from cache', error as Error);
    }
  }

  /**
   * Delete multiple embeddings from cache
   */
  async mdelete(texts: string[]): Promise<void> {
    try {
      const keys = texts.map((t) => this.keyPrefix + this.hash(t));
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cache mdeleted', { count: keys.length });
      }
    } catch (error) {
      logger.error('Failed to mdelete from cache', error as Error);
    }
  }

  /**
   * Clear all embeddings from cache
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache cleared', { keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Failed to clear cache', error as Error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
    logger.info('Cache stats reset');
  }

  /**
   * Check if cache is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get TTL for a specific text
   */
  async getTTL(text: string): Promise<number> {
    try {
      const key = this.keyPrefix + this.hash(text);
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error('Failed to get TTL', error as Error);
      return -1;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    logger.info('Embeddings cache connection closed');
  }
}
