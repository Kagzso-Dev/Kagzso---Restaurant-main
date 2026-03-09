/**
 * PM2 Ecosystem Config — KAGZSO POS
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart kagzso-pos
 *   pm2 stop    kagzso-pos
 *   pm2 logs    kagzso-pos
 *   pm2 monit
 */
module.exports = {
    apps: [
        {
            name:         'kagzso-pos',
            script:       './server/server.js',
            cwd:          __dirname,

            // ── Clustering ─────────────────────────────────────────────────
            // 'max' uses all CPU cores; use 1 for Socket.IO without sticky sessions
            instances:    1,
            exec_mode:    'fork',   // use 'cluster' only with a load balancer

            // ── Auto-restart policy ────────────────────────────────────────
            watch:        false,    // don't watch files in production
            max_memory_restart: '512M',
            restart_delay: 3000,
            max_restarts:  10,

            // ── Environment ────────────────────────────────────────────────
            env_production: {
                NODE_ENV:  'production',
                PORT:      5005,
            },

            // ── Logging ────────────────────────────────────────────────────
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file:  './server/logs/pm2-error.log',
            out_file:    './server/logs/pm2-out.log',
            merge_logs:  true,
        },
    ],
};
