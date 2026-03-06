import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Bell, Check, CheckCheck, Volume2, VolumeX, Megaphone, ShoppingBag, CreditCard, ChefHat, AlertTriangle, X } from 'lucide-react';

// ── Notification type metadata ───────────────────────────────────────────────
const typeConfig = {
    NEW_ORDER: { icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'New Order' },
    ORDER_READY: { icon: ChefHat, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Order Ready' },
    PAYMENT_SUCCESS: { icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Payment' },
    ORDER_CANCELLED: { icon: X, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Cancelled' },
    OFFER_ANNOUNCEMENT: { icon: Megaphone, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Offer' },
    SYSTEM_ALERT: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'System' },
};

// ── Sound alert types per role ───────────────────────────────────────────────
const SOUND_TRIGGERS = {
    kitchen: ['NEW_ORDER'],
    cashier: ['PAYMENT_SUCCESS'],
};

// ── Time-ago helper ──────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

/**
 * NotificationBell
 * ────────────────
 * Global bell icon with:
 *   • Real-time unread badge
 *   • Dropdown with latest 20 notifications
 *   • Individual + bulk mark-as-read
 *   • Sound alert for specific types
 *   • Multi-device sync via Socket.IO
 */
const NotificationBell = () => {
    const { user, socket, role } = useContext(AuthContext);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => {
        try { return localStorage.getItem('notif_sound') !== 'off'; } catch { return true; }
    });
    const dropdownRef = useRef(null);
    const audioRef = useRef(null);
    const lastSoundRef = useRef(0); // Debounce sound

    // ── Fetch unread count ───────────────────────────────────────────────────
    const fetchUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const res = await api.get('/api/notifications/unread-count');
            setUnreadCount(res.data.count || 0);
        } catch (err) {
            console.error('[NotifBell] Unread count error:', err.message);
        }
    }, [user]);

    // ── Fetch notification list ──────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await api.get('/api/notifications?limit=20');
            setNotifications(res.data.notifications || []);
        } catch (err) {
            console.error('[NotifBell] Fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // ── Play alert sound (debounced, non-repeating) ──────────────────────────
    const playAlertSound = useCallback(() => {
        if (!soundEnabled) return;
        const now = Date.now();
        // Throttle: no repeat within 3 seconds
        if (now - lastSoundRef.current < 3000) return;
        lastSoundRef.current = now;

        try {
            if (!audioRef.current) {
                // Use Web Audio API for a clean notification chime
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            }
        } catch { /* Audio not supported — silent fallback */ }
    }, [soundEnabled]);

    // ── Toggle sound preference ──────────────────────────────────────────────
    const toggleSound = () => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        try { localStorage.setItem('notif_sound', next ? 'on' : 'off'); } catch { }
    };

    // ── Initial load: unread count ───────────────────────────────────────────
    useEffect(() => {
        fetchUnreadCount();
        // Refresh unread count every 60s as fallback
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // ── Socket: real-time notifications ──────────────────────────────────────
    useEffect(() => {
        if (!socket || !role) return;

        const handleNewNotification = (data) => {
            const { notification, roleTarget } = data;
            // Only accept if targeted at our role or 'all'
            if (roleTarget !== role && roleTarget !== 'all') return;

            // Update unread count
            setUnreadCount(prev => prev + 1);

            // Prepend to notification list (if dropdown has been loaded)
            setNotifications(prev => {
                const exists = prev.find(n => n._id === notification._id);
                if (exists) return prev;
                return [{ ...notification, isRead: false }, ...prev].slice(0, 20);
            });

            // Sound alert for specific types per role
            const triggers = SOUND_TRIGGERS[role] || [];
            if (triggers.includes(notification.type)) {
                playAlertSound();
            }
        };

        const handleReadSync = (data) => {
            const { notificationIds, userId } = data;
            if (userId !== user?._id) return; // Only sync for same user
            setNotifications(prev =>
                prev.map(n =>
                    notificationIds.includes(n._id)
                        ? { ...n, isRead: true }
                        : n
                )
            );
            fetchUnreadCount();
        };

        const handleReadAllSync = (data) => {
            if (data.userId !== user?._id) return;
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        };

        socket.on('new-notification', handleNewNotification);
        socket.on('notifications-read', handleReadSync);
        socket.on('notifications-read-all', handleReadAllSync);

        return () => {
            socket.off('new-notification', handleNewNotification);
            socket.off('notifications-read', handleReadSync);
            socket.off('notifications-read-all', handleReadAllSync);
        };
    }, [socket, role, user, playAlertSound, fetchUnreadCount]);

    // ── Close dropdown on click outside ──────────────────────────────────────
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // ── Open dropdown: load latest ───────────────────────────────────────────
    const handleToggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next) fetchNotifications();
    };

    // ── Mark single notification as read ─────────────────────────────────────
    const handleMarkRead = async (notifId) => {
        try {
            await api.put('/api/notifications/read', { notificationIds: [notifId] });
            setNotifications(prev =>
                prev.map(n => n._id === notifId ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('[NotifBell] Mark read error:', err.message);
        }
    };

    // ── Mark all as read ─────────────────────────────────────────────────────
    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('[NotifBell] Mark all read error:', err.message);
        }
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* ── Bell Button ────────────────────────────────────────────── */}
            <button
                onClick={handleToggle}
                className={`
                    relative p-2 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px]
                    flex items-center justify-center
                    ${isOpen
                        ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)]'
                    }
                `}
                aria-label="Notifications"
                id="notification-bell"
            >
                <Bell size={19} className={unreadCount > 0 ? 'animate-bounce' : ''} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full ring-2 ring-[var(--theme-bg-dark)] animate-scale-in">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* ── Dropdown Panel ──────────────────────────────────────────── */}
            {isOpen && (
                <div className="
                    absolute top-full right-0 mt-2 w-[340px] sm:w-[380px]
                    bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl
                    shadow-2xl shadow-black/50 overflow-hidden z-50
                    animate-fade-in
                ">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-bg-hover)]">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-orange-400" />
                            <h3 className="text-sm font-bold text-[var(--theme-text-main)]">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-full font-bold border border-red-500/20">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Sound toggle */}
                            <button
                                onClick={toggleSound}
                                className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] transition-colors"
                                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
                            >
                                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                            </button>
                            {/* Mark all read */}
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck size={12} /> Read All
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-[var(--theme-border)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-text-muted)]">
                                <Bell size={32} className="opacity-20 mb-3" />
                                <p className="text-sm font-medium">No notifications</p>
                                <p className="text-xs mt-1 opacity-60">You're all caught up</p>
                            </div>
                        ) : (
                            notifications.map(notif => {
                                const config = typeConfig[notif.type] || typeConfig.SYSTEM_ALERT;
                                const IconComp = config.icon;
                                return (
                                    <div
                                        key={notif._id}
                                        className={`
                                            flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer group
                                            ${notif.isRead
                                                ? 'opacity-60 hover:opacity-80'
                                                : 'bg-[var(--theme-bg-hover)]/30 hover:bg-[var(--theme-bg-hover)]'
                                            }
                                        `}
                                        onClick={() => !notif.isRead && handleMarkRead(notif._id)}
                                    >
                                        {/* Icon */}
                                        <div className={`
                                            w-9 h-9 rounded-xl flex-shrink-0
                                            flex items-center justify-center
                                            ${config.bg} ${config.border} border
                                        `}>
                                            <IconComp size={16} className={config.color} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={`text-xs font-bold truncate ${notif.isRead ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-main)]'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.isRead && (
                                                    <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 animate-pulse" />
                                                )}
                                            </div>
                                            <p className="text-[11px] text-[var(--theme-text-subtle)] mt-0.5 leading-relaxed line-clamp-2">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${config.bg} ${config.color} ${config.border} border`}>
                                                    {config.label}
                                                </span>
                                                <span className="text-[10px] text-[var(--theme-text-subtle)]">
                                                    {timeAgo(notif.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Read toggle */}
                                        {!notif.isRead && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkRead(notif._id);
                                                }}
                                                className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-green-400 hover:bg-green-500/10 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                                title="Mark as read"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-[var(--theme-border)] bg-[var(--theme-bg-hover)]">
                            <p className="text-[10px] text-[var(--theme-text-subtle)] text-center">
                                Showing latest {notifications.length} notifications
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
