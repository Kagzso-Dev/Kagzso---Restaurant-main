require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const { connectDB, pool } = require('./config/db');
const logger = require('./utils/logger');
const { getCacheStats } = require('./utils/cache');
const { socketAuthMiddleware, authorizedRoomJoin, authorizedRoleJoin } = require('./middleware/socketAuth');

const app = express();
const server = http.createServer(app);

// ─── Resolve client/dist path (works both locally and on VPS) ────────────────
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const hasFrontend = fs.existsSync(CLIENT_DIST);

// ─── CORS Configuration ───────────────────────────────────────────────────────
// Set CLIENT_URL or FRONTEND_URL in your .env to your Netlify URL, e.g.:
//   CLIENT_URL=https://your-app.netlify.app
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://kagzso-pos-frontend.onrender.com',
    process.env.CLIENT_URL,    // Primary: set this to your Netlify/CDN URL
    process.env.FRONTEND_URL,  // Alias for CLIENT_URL
    process.env.VPS_URL,       // Direct VPS IP/hostname if needed
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // No origin = same-origin request (curl, mobile app, or same-server) → allow
        if (!origin) return callback(null, true);
        if (
            allowedOrigins.includes(origin) ||
            process.env.NODE_ENV === 'development'
        ) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked', { origin });
            callback(new Error(`CORS: origin '${origin}' not in allowed list`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
};

// ─── Global Middleware ────────────────────────────────────────────────────────
// Helmet with relaxed CSP so the React SPA (inline scripts, WebSocket) works.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'", "'unsafe-inline'"],
            styleSrc:   ["'self'", "'unsafe-inline'"],
            imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
            fontSrc:    ["'self'", 'data:'],
            workerSrc:  ["'self'", 'blob:'],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(cors(corsOptions));
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(logger.requestLogger);
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
    skip: (req) => req.path === '/' || req.path === '/health',
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ─── Socket.IO Server ─────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 30000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
    },
    maxHttpBufferSize: 1e6,
});

io.use(socketAuthMiddleware);

// ─── API Routes ───────────────────────────────────────────────────────────────
// Must be registered BEFORE static file serving so /api/* never falls through
// to index.html.
app.use('/api/auth',           require('./routes/authRoutes'));
app.use('/api/orders',         require('./routes/orderRoutes'));
app.use('/api/tables',         require('./routes/tableRoutes'));
app.use('/api/menu',           require('./routes/menuRoutes'));
app.use('/api/categories',     require('./routes/categoryRoutes'));
app.use('/api/settings',       require('./routes/settingRoutes'));
app.use('/api/dashboard',      require('./routes/dashboardRoutes'));
app.use('/api/analytics',      require('./routes/analyticsRoutes'));
app.use('/api/payments',       require('./routes/paymentRoutes'));
app.use('/api/notifications',  require('./routes/notificationRoutes'));
app.use('/api/webhooks',       require('./routes/webhookRoutes'));

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    logger.info('Socket connected', {
        socketId: socket.id,
        userId:   socket.userId,
        role:     socket.role,
    });

    socket.on('join-branch', () => {
        authorizedRoomJoin(socket);
    });

    socket.on('join-role', ({ role }) => {
        if (!role) return;
        authorizedRoleJoin(socket, role);
    });

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

app.set('socketio', io);

// ─── Auto-Release Timer (reserved tables idle > 10 min) ──────────────────────
// The recurring interval starts immediately; the INITIAL run is deferred to
// startServer() so the DB connection is guaranteed to be ready first.
const { autoReleaseExpiredReservations } = require('./controllers/tableController');
setInterval(() => autoReleaseExpiredReservations(io), 2 * 60 * 1000);

// ─── Health Check (JSON — always available, even without frontend build) ──────
app.get('/health', async (req, res) => {
    const uptime   = process.uptime();
    const memUsage = process.memoryUsage();

    // Check MySQL connectivity
    let dbStatus = 'disconnected';
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        dbStatus = 'connected';
    } catch {
        dbStatus = 'error';
    }

    // Guard against a missing or malformed package.json on the VPS
    let version = '1.0.0';
    try { version = require('./package.json').version || '1.0.0'; } catch { /* ignore */ }

    res.json({
        status:      dbStatus === 'connected' ? 'healthy' : 'degraded',
        timestamp:   new Date().toISOString(),
        uptime:      `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        version,
        environment: process.env.NODE_ENV || 'development',
        node:        process.version,
        frontend:    hasFrontend ? 'built' : 'not built (run: npm run build in client/)',

        database: {
            state: dbStatus,
            host:  process.env.DB_HOST || 'N/A',
            name:  process.env.DB_NAME || 'N/A',
        },

        sockets: {
            connected: io.engine.clientsCount,
            rooms:     io.sockets.adapter.rooms.size,
        },

        memory: {
            rss:       `${(memUsage.rss       / 1024 / 1024).toFixed(1)} MB`,
            heapUsed:  `${(memUsage.heapUsed  / 1024 / 1024).toFixed(1)} MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`,
            external:  `${(memUsage.external  / 1024 / 1024).toFixed(1)} MB`,
        },

        cache: getCacheStats(),
        pid:   process.pid,
    });
});

// ─── Serve React Frontend (production build) ──────────────────────────────────
// MUST come after all /api/* routes so API calls never return index.html.
if (hasFrontend) {
    // Static assets (JS, CSS, images) — 1-day browser cache
    app.use(express.static(CLIENT_DIST, {
        maxAge: '1d',
        etag:   true,
        setHeaders: (res, filePath) => {
            // Never cache index.html so new deployments take effect immediately
            if (filePath.endsWith('index.html')) {
                res.setHeader('Cache-Control', 'no-store');
            }
        },
    }));

    // SPA catch-all: every non-asset GET returns index.html for React Router.
    //
    // FIX (Express v5): Express v5 uses path-to-regexp v8, which requires all
    // wildcards to be named.  The old bare '*' pattern throws at startup:
    //   TypeError: Missing parameter name at index 1: *
    // Solution: use the named wildcard syntax '/{*splat}'.
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });

    logger.info(`Frontend: serving React build from ${CLIENT_DIST}`);
} else {
    // No frontend build yet — return a helpful JSON message at root
    app.get('/', (req, res) => res.json({
        status:  'ok',
        message: 'KOT API is running. Frontend not built yet.',
        hint:    'Run: cd client && npm install && npm run build',
        health:  '/health',
        api:     '/api',
    }));
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express v5: async route errors are automatically forwarded here without
// needing an explicit next(err) call.
// Checks both err.statusCode (custom errors) and err.status (set by Express).
app.use((err, req, res, next) => {
    logger.error('Unhandled route error', {
        error:     err.message,
        stack:     err.stack,
        method:    req.method,
        url:       req.originalUrl,
        requestId: req.requestId,
    });
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
        success:   false,
        message:   err.message || 'Internal Server Error',
        requestId: req.requestId,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    // Force-exit fallback in case something hangs.
    // .unref() lets the event loop exit naturally if everything closes before
    // the 10-second deadline without needing this timer to fire.
    const forceExit = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(() => logger.info('HTTP server closed'));
    io.close(()     => logger.info('Socket.IO server closed'));

    try {
        await pool.end();
        logger.info('MySQL connection pool closed');
    } catch (err) {
        logger.error('Error closing MySQL pool', { error: err.message });
    }

    clearTimeout(forceExit);
    process.exit(0);
};

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack:  reason?.stack,
    });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    if (err.code === 'EADDRINUSE') process.exit(1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────
const startServer = async () => {
    try {
        await connectDB();

        const PORT = parseInt(process.env.PORT) || 5005;
        server.listen(PORT, '0.0.0.0', () => {
            logger.info('Server started', {
                port:     PORT,
                env:      process.env.NODE_ENV || 'development',
                pid:      process.pid,
                origins:  allowedOrigins,
                frontend: hasFrontend ? CLIENT_DIST : 'not built',
            });
            logger.info('Socket.IO ready for multi-device connections');
            logger.info(`Health check: http://localhost:${PORT}/health`);
            if (hasFrontend) logger.info(`UI available at: http://localhost:${PORT}`);
        });

        // Run the FIRST auto-release check now that DB is confirmed ready.
        // Subsequent checks run via setInterval above.
        autoReleaseExpiredReservations(io).catch((err) =>
            logger.warn('Initial auto-release check failed', { error: err.message })
        );
    } catch (err) {
        console.error('CRITICAL: Server startup failed', err);
        process.exit(1);
    }
};

startServer();
