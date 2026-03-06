const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * ─── MongoDB Connection with Scalability Options ─────────────────────────────
 *
 * Features:
 *   • Connection pool sizing (configurable via MONGO_POOL_SIZE)
 *   • Read preference for analytics offloading to secondaries
 *   • Auto-reconnect with exponential backoff
 *   • Connection event monitoring
 *   • Graceful error handling
 */
const connectDB = async () => {
  const options = {
    // ── Connection Pool ──────────────────────────────────
    // Each worker (PM2/Docker) maintains this many connections.
    // Default 10 handles ~50 concurrent requests per worker.
    maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE) || 10,
    minPoolSize: 2,

    // ── Timeouts ─────────────────────────────────────────
    serverSelectionTimeoutMS: 5000,     // Fail fast if no server available
    socketTimeoutMS: 45000,             // Kill slow queries
    connectTimeoutMS: 10000,            // Initial connection timeout

    // ── Read Preference ──────────────────────────────────
    // 'secondaryPreferred' offloads read-heavy analytics to replica secondaries
    // Falls back to primary if secondaries unavailable (safe for single-node dev)
    readPreference: process.env.MONGO_READ_PREF || 'primaryPreferred',

    // ── Retry ────────────────────────────────────────────
    retryWrites: true,
    retryReads: true,

    // ── Write Concern ────────────────────────────────────
    // 'majority' ensures writes survive primary failure (for replica sets)
    w: process.env.NODE_ENV === 'production' ? 'majority' : 1,

    // ── Misc ─────────────────────────────────────────────
    autoIndex: process.env.NODE_ENV !== 'production', // Disable auto-indexing in prod
    compressors: ['zstd', 'snappy', 'zlib'],          // Wire compression
  };

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    logger.info('MongoDB connected', {
      host: conn.connection.host,
      database: conn.connection.name,
      poolSize: options.maxPoolSize,
      readPref: options.readPreference,
    });
  } catch (error) {
    logger.error('MongoDB connection failed', {
      error: error.message,
      uri: process.env.MONGO_URI?.replace(/\/\/.*@/, '//<credentials>@'), // mask creds
    });
    process.exit(1);
  }

  // ── Connection Event Monitoring ──────────────────────────────────────────
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { error: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — driver will auto-reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  // ── Slow Query Monitoring (development) ─────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    mongoose.set('debug', (collectionName, method, query, doc) => {
      if (process.env.MONGO_DEBUG === 'true') {
        logger.debug(`Mongoose: ${collectionName}.${method}`, {
          query: JSON.stringify(query).substring(0, 200),
        });
      }
    });
  }
};

module.exports = connectDB;
