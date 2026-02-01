import { createHash } from 'crypto';

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number; // milliseconds
  agent: string;
  model: string;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface CacheOptions {
  ttl?: number; // default 1 hour
  maxSize?: number; // max cache size in entries
}

export class ExecutionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private options: Required<CacheOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 60 * 60 * 1000, // 1 hour default
      maxSize: options.maxSize || 10000,
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Generate cache key from agent, model, and input
   */
  generateKey(agent: string, model: string, input: string): string {
    const combined = `${agent}:${model}:${input}`;
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get from cache
   */
  get(agent: string, model: string, input: string): any | null {
    const key = this.generateKey(agent, model, input);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cache entry
   */
  set(
    agent: string,
    model: string,
    input: string,
    value: any,
    ttl?: number,
    tokens?: { input: number; output: number },
  ): void {
    // Enforce max size
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const key = this.generateKey(agent, model, input);
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.options.ttl,
      agent,
      model,
      tokens,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear specific agent cache
   */
  clearAgent(agent: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (entry.agent === agent) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const agentStats: Record<string, number> = {};

    this.cache.forEach((entry) => {
      if (entry.tokens) {
        totalInputTokens += entry.tokens.input;
        totalOutputTokens += entry.tokens.output;
      }
      agentStats[entry.agent] = (agentStats[entry.agent] || 0) + 1;
    });

    return {
      size: this.cache.size,
      totalInputTokens,
      totalOutputTokens,
      agentStats,
    };
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   */
  private removeExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.removeExpired();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Stop cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroy cache
   */
  destroy(): void {
    this.stop();
    this.clear();
  }
}

// Global cache instance
let globalCache: ExecutionCache | null = null;

export function getExecutionCache(): ExecutionCache {
  if (!globalCache) {
    globalCache = new ExecutionCache();
  }
  return globalCache;
}

export function resetExecutionCache(): void {
  if (globalCache) {
    globalCache.destroy();
    globalCache = null;
  }
}
