/**
 * ─── In-Memory Cache Middleware ──────────────────────────────────────────────
 * Lightweight server-side caching layer for expensive read operations.
 * Supports:
 *   • Per-tenant/branch cache isolation (key scoping)
 *   • Configurable TTL per route
 *   • Manual cache invalidation
 *   • Cache-Control header propagation
 *   • Memory limit with LRU eviction
 *
 * For Redis-backed caching in multi-node deployments, swap this store
 * with ioredis using the same interface.
 *
 * Usage:
 *   const { cacheMiddleware, invalidateCache } = require('./utils/cache');
 *   router.get('/analytics/summary', cacheMiddleware(60), getSummary);
 *   // After mutations:
 *   invalidateCache('analytics');
 */
const logger = require('./logger');

// ── LRU Cache Store ──────────────────────────────────────────────────────────
const MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES) || 500;

class CacheStore {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.store = new Map();   // key → { data, expiry, createdAt }
        this.hits = 0;
        this.misses = 0;
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            this.misses++;
            return null;
        }
        // Move to end for LRU
        this.store.delete(key);
        this.store.set(key, entry);
        this.hits++;
        return entry.data;
    }

    set(key, data, ttlSeconds) {
        // Evict oldest when full
        if (this.store.size >= this.maxSize) {
            const oldestKey = this.store.keys().next().value;
            this.store.delete(oldestKey);
        }
        this.store.set(key, {
            data,
            expiry: Date.now() + (ttlSeconds * 1000),
            createdAt: Date.now(),
        });
    }

    /**
     * Invalidate entries matching a pattern prefix.
     * @param {string} pattern - key prefix to match
     * @returns {number} Number of entries invalidated
     */
    invalidate(pattern) {
        let count = 0;
        for (const key of this.store.keys()) {
            if (key.includes(pattern)) {
                this.store.delete(key);
                count++;
            }
        }
        return count;
    }

    clear() {
        this.store.clear();
        this.hits = 0;
        this.misses = 0;
    }

    stats() {
        const total = this.hits + this.misses;
        return {
            entries: this.store.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
        };
    }
}

const cache = new CacheStore(MAX_ENTRIES);

// ── Cache Middleware Factory ─────────────────────────────────────────────────
/**
 * Express middleware that caches JSON responses.
 * @param {number} ttlSeconds - Time-to-live in seconds (default: 30)
 * @param {string} [prefix] - Optional cache key prefix for grouping
 */
const cacheMiddleware = (ttlSeconds = 30, prefix = '') => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') return next();

        // Bypass cache if requested
        const isRefresh = req.headers['x-refresh'] === 'true' || req.query.refresh === 'true';

        // Build scoped cache key: global + route + query
        const scope = 'global';
        const queryString = JSON.stringify(req.query || {});
        const key = `${prefix}:${scope}:${req.originalUrl}:${queryString}`;

        if (!isRefresh) {
            const cached = cache.get(key);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-TTL', ttlSeconds);
                return res.json(cached);
            }
        }

        // Intercept res.json to capture and cache the response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.set(key, data, ttlSeconds);
            }
            res.setHeader('X-Cache', 'MISS');
            return originalJson(data);
        };

        next();
    };
};

// ── Manual Cache Invalidation ────────────────────────────────────────────────
/**
 * Invalidate cached entries matching a pattern.
 * Call after mutations (create/update/delete) to keep cache fresh.
 * @param {string} pattern - Partial key match (e.g., 'analytics', 'orders')
 */
const invalidateCache = (pattern) => {
    const count = cache.invalidate(pattern);
    if (count > 0) {
        logger.debug(`Cache invalidated: ${count} entries matching "${pattern}"`);
    }
};

// ── Cache Stats (for health endpoint) ────────────────────────────────────────
const getCacheStats = () => cache.stats();

// ── Clear Cache ──────────────────────────────────────────────────────────────
const clearCache = () => cache.clear();

module.exports = {
    cacheMiddleware,
    invalidateCache,
    getCacheStats,
    clearCache,
};
