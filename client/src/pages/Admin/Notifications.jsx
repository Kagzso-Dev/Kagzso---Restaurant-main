import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    Bell, Send, Megaphone, Users, ChefHat, CreditCard,
    ShoppingBag, AlertTriangle, CheckCheck, RefreshCw,
    X, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Type config ──────────────────────────────────────────────────────────────
const typeConfig = {
    NEW_ORDER: { icon: ShoppingBag, color: 'blue', label: 'New Order' },
    ORDER_READY: { icon: ChefHat, color: 'green', label: 'Order Ready' },
    PAYMENT_SUCCESS: { icon: CreditCard, color: 'emerald', label: 'Payment' },
    ORDER_CANCELLED: { icon: X, color: 'red', label: 'Cancelled' },
    OFFER_ANNOUNCEMENT: { icon: Megaphone, color: 'orange', label: 'Offer' },
    SYSTEM_ALERT: { icon: AlertTriangle, color: 'yellow', label: 'System' },
};

const roleOptions = [
    { id: 'all', label: 'All Staff', icon: Users, desc: 'Every role receives this' },
    { id: 'kitchen', label: 'Kitchen', icon: ChefHat, desc: 'Kitchen display staff' },
    { id: 'waiter', label: 'Waiters', icon: ShoppingBag, desc: 'Serving staff' },
    { id: 'cashier', label: 'Cashiers', icon: CreditCard, desc: 'Billing staff' },
];

const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Just now';
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const AdminNotifications = () => {
    const { user, socket } = useContext(AuthContext);

    // ── Offer form state ─────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [roleTarget, setRoleTarget] = useState('all');
    const [sending, setSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState('');

    // ── Notification history state ───────────────────────────────────────────
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedForm, setExpandedForm] = useState(true);

    // ── Fetch notification history ───────────────────────────────────────────
    const fetchNotifications = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/notifications?page=${p}&limit=20`);
            setNotifications(res.data.notifications || []);
            setTotalPages(res.data.pagination?.pages || 1);
            setPage(p);
        } catch (err) {
            console.error('[AdminNotif] Fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications(1);
    }, [fetchNotifications]);

    // ── Real-time: new notifications ─────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;
        const handle = (data) => {
            setNotifications(prev => {
                const exists = prev.find(n => n._id === data.notification._id);
                if (exists) return prev;
                return [{ ...data.notification, isRead: false }, ...prev].slice(0, 20);
            });
        };
        socket.on('new-notification', handle);
        return () => socket.off('new-notification', handle);
    }, [socket]);

    // ── Send offer ───────────────────────────────────────────────────────────
    const handleSendOffer = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;

        setSending(true);
        setSendError('');
        setSendSuccess(false);

        try {
            await api.post('/api/notifications/offer', {
                title: title.trim(),
                message: message.trim(),
                roleTarget,
            });
            setSendSuccess(true);
            setTitle('');
            setMessage('');
            setRoleTarget('all');
            fetchNotifications(1);

            setTimeout(() => setSendSuccess(false), 3000);
        } catch (err) {
            setSendError(err.response?.data?.message || 'Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    // ── Mark all as read ─────────────────────────────────────────────────────
    const handleMarkAllRead = async () => {
        try {
            await api.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (err) {
            console.error('[AdminNotif] Mark all error:', err.message);
        }
    };

    // ── Stats ────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const unread = notifications.filter(n => !n.isRead).length;
        const offers = notifications.filter(n => n.type === 'OFFER_ANNOUNCEMENT').length;
        return { unread, offers, total: notifications.length };
    }, [notifications]);

    return (
        <div className="space-y-5 animate-fade-in pb-10">
            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-bg-card2)] rounded-2xl p-5 border border-[var(--theme-border)]">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-glow-orange flex-shrink-0">
                        <Bell size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-[var(--theme-text-main)]">
                            Notifications
                            <span className="text-[var(--theme-text-muted)] font-normal ml-2 text-base">Center</span>
                        </h1>
                        <p className="text-xs text-[var(--theme-text-subtle)] mt-0.5">
                            Send offers & view all system alerts
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => fetchNotifications(1)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border border-[var(--theme-border)] rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                    >
                        <RefreshCw size={15} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    {stats.unread > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md min-h-[44px]"
                        >
                            <CheckCheck size={15} />
                            <span>Mark All Read ({stats.unread})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Stats Cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--theme-text-muted)]">Total</p>
                    <p className="text-2xl font-black text-[var(--theme-text-main)] mt-1">{stats.total}</p>
                </div>
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-red-400">Unread</p>
                    <p className="text-2xl font-black text-red-400 mt-1">{stats.unread}</p>
                </div>
                <div className="bg-[var(--theme-bg-card)] p-4 rounded-2xl border border-[var(--theme-border)]">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-orange-400">Offers Sent</p>
                    <p className="text-2xl font-black text-orange-400 mt-1">{stats.offers}</p>
                </div>
            </div>

            {/* ── Offer Broadcast Panel ───────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <button
                    onClick={() => setExpandedForm(!expandedForm)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--theme-bg-hover)] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                            <Megaphone size={16} className="text-orange-400" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-sm font-bold text-[var(--theme-text-main)]">Send Offer / Announcement</h2>
                            <p className="text-[10px] text-[var(--theme-text-subtle)]">Broadcast to all staff or specific roles</p>
                        </div>
                    </div>
                    {expandedForm ? <ChevronUp size={16} className="text-[var(--theme-text-muted)]" /> : <ChevronDown size={16} className="text-[var(--theme-text-muted)]" />}
                </button>

                {expandedForm && (
                    <form onSubmit={handleSendOffer} className="px-5 pb-5 space-y-4 border-t border-[var(--theme-border)]">
                        {/* Success / Error messages */}
                        {sendSuccess && (
                            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                                <CheckCheck size={16} className="text-emerald-400" />
                                <p className="text-sm font-bold text-emerald-400">Notification sent successfully!</p>
                            </div>
                        )}
                        {sendError && (
                            <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                                <AlertTriangle size={16} className="text-red-400" />
                                <p className="text-sm font-bold text-red-400">{sendError}</p>
                            </div>
                        )}

                        {/* Title */}
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Happy Hour 50% Off!"
                                maxLength={200}
                                className="w-full px-4 py-3 bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] rounded-xl text-sm text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)] focus:outline-none focus:border-orange-500/50 transition-colors"
                                required
                                id="offer-title"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe the offer or announcement..."
                                maxLength={500}
                                rows={3}
                                className="w-full px-4 py-3 bg-[var(--theme-bg-hover)] border border-[var(--theme-border)] rounded-xl text-sm text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)] focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                                required
                                id="offer-message"
                            />
                            <p className="text-[10px] text-[var(--theme-text-subtle)] text-right mt-1">
                                {message.length}/500
                            </p>
                        </div>

                        {/* Role Target */}
                        <div>
                            <label className="block text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider mb-2">
                                Send To
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {roleOptions.map(opt => {
                                    const Icon = opt.icon;
                                    const isSelected = roleTarget === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setRoleTarget(opt.id)}
                                            className={`
                                                flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all
                                                ${isSelected
                                                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 ring-1 ring-orange-500/20'
                                                    : 'bg-[var(--theme-bg-hover)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-subtle)]'
                                                }
                                            `}
                                        >
                                            <Icon size={18} />
                                            <span className="text-xs font-bold">{opt.label}</span>
                                            <span className="text-[9px] opacity-60">{opt.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={sending || !title.trim() || !message.trim()}
                            className={`
                                w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black
                                transition-all duration-200 min-h-[48px]
                                ${sending || !title.trim() || !message.trim()
                                    ? 'bg-[var(--theme-bg-hover)] text-[var(--theme-text-subtle)] cursor-not-allowed'
                                    : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-glow-orange active:scale-[0.98]'
                                }
                            `}
                            id="send-offer-btn"
                        >
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Broadcast Notification
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* ── Notification History ────────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)]">
                    <h2 className="text-sm font-bold text-[var(--theme-text-main)]">Notification History</h2>
                    <p className="text-[10px] text-[var(--theme-text-subtle)] mt-0.5">All notifications across the system</p>
                </div>

                <div className="divide-y divide-[var(--theme-border)]">
                    {loading ? (
                        <div className="p-8 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--theme-text-muted)]">
                            <Bell size={40} className="opacity-20 mb-3" />
                            <p className="text-sm font-medium">No notifications yet</p>
                            <p className="text-xs mt-1 opacity-60">System alerts will appear here</p>
                        </div>
                    ) : (
                        notifications.map(notif => {
                            const config = typeConfig[notif.type] || typeConfig.SYSTEM_ALERT;
                            const Icon = config.icon;
                            return (
                                <div
                                    key={notif._id}
                                    className={`
                                        flex items-start gap-3 px-5 py-4 transition-colors
                                        ${notif.isRead ? 'opacity-60' : 'bg-[var(--theme-bg-hover)]/20'}
                                    `}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-xl flex-shrink-0
                                        flex items-center justify-center
                                        bg-${config.color}-500/10 border border-${config.color}-500/20
                                    `}>
                                        <Icon size={18} className={`text-${config.color}-400`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-sm font-bold ${notif.isRead ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-main)]'}`}>
                                                {notif.title}
                                            </p>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!notif.isRead && (
                                                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                                )}
                                                <span className="text-[10px] text-[var(--theme-text-subtle)]">
                                                    {timeAgo(notif.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[var(--theme-text-subtle)] mt-0.5 leading-relaxed">
                                            {notif.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/20`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                                → {notif.roleTarget}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-[var(--theme-border)] flex items-center justify-between">
                        <p className="text-xs text-[var(--theme-text-subtle)]">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => fetchNotifications(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => fetchNotifications(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminNotifications;
