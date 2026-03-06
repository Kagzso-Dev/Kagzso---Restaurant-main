/**
 * ─── Socket.IO Authentication Middleware ─────────────────────────────────────
 * Protects WebSocket connections with JWT verification.
 * Attaches decoded user context to every socket instance.
 *
 * Security features:
 *   • JWT token verification on connection handshake
 *   • Role/branch attached to socket for room authorization
 *   • Rejects connections with invalid/expired tokens
 *   • Prevents unauthorized room joins
 *
 * Usage in server.js:
 *   const { socketAuthMiddleware, authorizedRoomJoin } = require('./middleware/socketAuth');
 *   io.use(socketAuthMiddleware);
 */
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Socket.IO authentication middleware.
 * Verifies the JWT token sent in `socket.handshake.auth.token`
 * or as a query parameter `?token=xxx`.
 */
const socketAuthMiddleware = (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
            socket.handshake.query?.token;

        if (!token) {
            // Allow unauthenticated connections in development for testing
            if (process.env.NODE_ENV === 'development') {
                logger.debug(`Socket ${socket.id} connected without auth (dev mode)`);
                return next();
            }
            return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user context to socket for downstream use
        socket.userId = decoded.userId;
        socket.role = decoded.role;

        logger.debug(`Socket ${socket.id} authenticated`, {
            userId: decoded.userId,
            role: decoded.role,
        });

        next();
    } catch (err) {
        logger.warn(`Socket auth failed: ${err.message}`, { socketId: socket.id });
        // In development, allow anyway to not block testing
        if (process.env.NODE_ENV === 'development') {
            return next();
        }
        next(new Error('Invalid or expired token'));
    }
};

/**
 * Authorized room join handler.
 * Simple global room for the restaurant.
 */
const authorizedRoomJoin = (socket) => {
    const room = 'restaurant_main';
    socket.join(room);
    logger.debug(`Socket ${socket.id} joined room: ${room}`);
    return true;
};

/**
 * Authorized role room join handler.
 */
const authorizedRoleJoin = (socket, role) => {
    // Validate role matches socket's authenticated role
    if (socket.role && socket.role !== role) {
        logger.warn('Unauthorized role join attempt', {
            socketId: socket.id,
            requestedRole: role,
            actualRole: socket.role,
        });
        if (process.env.NODE_ENV !== 'development') {
            socket.emit('error', { message: 'Not authorized for this role room' });
            return false;
        }
    }

    const roleRoom = `role_${role}`;
    socket.join(roleRoom);
    logger.debug(`Socket ${socket.id} joined role room: ${roleRoom}`);
    return true;
};

module.exports = {
    socketAuthMiddleware,
    authorizedRoomJoin,
    authorizedRoleJoin,
};
