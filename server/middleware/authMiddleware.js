const jwt = require('jsonwebtoken');

/**
 * protect - Verifies JWT and attaches decoded payload to req.
 * Stores: req.userId, req.role, req.user
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user context from JWT payload
            req.userId = decoded.userId;
            req.role = decoded.role;

            // Convenience alias
            req.user = {
                _id: decoded.userId,
                role: decoded.role,
            };

            next();
        } catch (error) {
            console.error('JWT verification failed:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            console.error('[Auth] Authorization failed: req.user is missing. Ensure protect middleware is before authorize.');
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Case-insensitive role check
        const userRole = (req.role || req.user.role || '').toLowerCase();
        const allowedRoles = roles.map(r => r.toLowerCase());

        if (!allowedRoles.includes(userRole)) {
            console.warn(`[Auth] 403 Forbidden: User '${req.userId}' with role '${userRole}' attempted to access route requiring one of [${allowedRoles.join(', ')}] at ${req.originalUrl}`);
            return res.status(403).json({
                message: `Forbidden: Your role '${userRole}' does not have permission to access this resource. Required: [${allowedRoles.join(', ')}]`,
                details: { userRole, allowedRoles }
            });
        }
        next();
    };
};

module.exports = { protect, authorize };

