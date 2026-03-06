require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { getCacheStats } = require('./utils/cache');
const { socketAuthMiddleware, authorizedRoomJoin, authorizedRoleJoin } = require('./middleware/socketAuth');

const app = express();
const server = http.createServer(app);

// ─── CORS Configuration ───────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
};

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet()); // Security headers
app.use(cors(corsOptions));
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Gzip compression — reduces payload size for mobile clients
app.use(compression());

// Body size limit — prevent oversized payloads
app.use(express.json({ limit: '10kb' }));

// Request logging — structured with timing
app.use(logger.requestLogger);

// Trust proxy (required on Render — sits behind a reverse proxy)
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Auth routes: strict limit to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// API routes: generous limit for normal concurrent usage
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX) || 300, // 300 requests/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
    skip: (req) => req.path === '/' || req.path === '/health', // Skip health checks
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ─── Socket.IO Server ─────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: corsOptions,
    // Reliability: try WebSocket first, fall back to polling for mobile networks
    transports: ['websocket', 'polling'],
    // Heartbeat settings for mobile clients behind aggressive NAT
    pingInterval: 10000,
    pingTimeout: 30000,
    // Connection state recovery for brief disconnections
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
    },
    // Limit payload size to prevent abuse
    maxHttpBufferSize: 1e6, // 1 MB
});

// ─── Socket Authentication ───────────────────────────────────────────────────
io.use(socketAuthMiddleware);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/tables', require('./routes/tableRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    logger.info('Socket connected', {
        socketId: socket.id,
        userId: socket.userId,
        role: socket.role,
    });

    // Join restaurant-wide room
    socket.on('join-branch', () => {
        authorizedRoomJoin(socket);
    });

    // Join role-specific room
    socket.on('join-role', ({ role }) => {
        if (!role) return;
        authorizedRoleJoin(socket, role);
    });

    // Legacy / generic room join support
    socket.on('join-room', (room) => {
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', (reason) => {
        logger.info('Socket disconnected', { socketId: socket.id, reason });
    });

    socket.on('connect_error', (err) => {
        logger.error('Socket connect error', { socketId: socket.id, error: err.message });
    });
});

// Make io accessible in all route handlers via req.app.get('socketio')
app.set('socketio', io);

// ─── Auto-Release Timer ───────────────────────────────────────────────────────
// Releases reserved tables that have been idle for 10 minutes
const { autoReleaseExpiredReservations } = require('./controllers/tableController');
setInterval(() => autoReleaseExpiredReservations(io), 2 * 60 * 1000);
autoReleaseExpiredReservations(io); // Run once at startup

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
    status: 'ok',
    message: 'KOT API running',
    environment: process.env.NODE_ENV || 'development',
    connections: io.engine.clientsCount,
}));

// ─── Detailed Health / Diagnostics ────────────────────────────────────────────
app.get('/health', async (req, res) => {
    const mongoose = require('mongoose');
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    res.json({
        status: dbState === 1 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        version: require('./package.json').version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        node: process.version,

        // Database
        database: {
            state: dbStates[dbState] || 'unknown',
            host: mongoose.connection.host || 'N/A',
            name: mongoose.connection.name || 'N/A',
        },

        // WebSocket
        sockets: {
            connected: io.engine.clientsCount,
            rooms: io.sockets.adapter.rooms.size,
        },

        // Memory (MB)
        memory: {
            rss: `${(memUsage.rss / 1024 / 1024).toFixed(1)} MB`,
            heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
            external: `${(memUsage.external / 1024 / 1024).toFixed(1)} MB`,
        },

        // Cache stats
        cache: getCacheStats(),

        // Process
        pid: process.pid,
    });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error('Unhandled route error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        requestId: req.requestId,
    });
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        requestId: req.requestId,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    // 1. Stop accepting new connections
    server.close(() => {
        logger.info('HTTP server closed');
    });

    // 2. Close all socket connections
    io.close(() => {
        logger.info('Socket.IO server closed');
    });

    // 3. Close database connection
    try {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
    } catch (err) {
        logger.error('Error closing MongoDB', { error: err.message });
    }

    // 4. Force exit after timeout (safety net)
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);

    process.exit(0);
};

// ─── Process Safety ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
    });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    if (err.code === 'EADDRINUSE') {
        process.exit(1);
    }
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Connect to Database first
const startServer = async () => {
    try {
        await connectDB();

        const PORT = parseInt(process.env.PORT) || 5000;
        server.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server started`, {
                port: PORT,
                env: process.env.NODE_ENV || 'development',
                pid: process.pid,
                origins: allowedOrigins,
            });
            logger.info(`Socket.IO ready for multi-device connections`);
            logger.info(`Health check: http://localhost:${PORT}/health`);
        });
    } catch (err) {
        console.error('CRITICAL: Server startup failed', err);
        process.exit(1);
    }
};

startServer();
