import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    TrendingUp, TrendingDown, ShoppingBag, Clock, DollarSign,
    Download, RefreshCw, ChevronDown
} from 'lucide-react';

/* ── Skeleton Card ───────────────────────────────────────────────────────── */
const SkeletonCard = () => (
    <div className="bg-[var(--theme-bg-card)] p-5 rounded-2xl border border-[var(--theme-border)] space-y-3">
        <div className="skeleton skeleton-text w-24 h-3" />
        <div className="skeleton skeleton-text w-32 h-8" />
        <div className="skeleton skeleton-text w-16 h-3" />
    </div>
);

/* ── Growth Badge ────────────────────────────────────────────────────────── */
const GrowthBadge = ({ growth, loading }) => {
    if (loading) {
        return <span className="skeleton skeleton-text w-14 h-5 rounded-full inline-block" />;
    }
    if (growth === null) return null;

    const isPositive = growth >= 0;
    const isZero = growth === 0;

    return (
        <span className={`
            inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
            ${isZero
                ? 'bg-gray-500/10 text-gray-400'
                : isPositive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
            }
        `}>
            {isZero ? null : isPositive
                ? <TrendingUp size={11} />
                : <TrendingDown size={11} />
            }
            {isZero ? '–' : `${isPositive ? '+' : ''}${growth}%`}
        </span>
    );
};

/* ── Stat Card ───────────────────────────────────────────────────────────── */
const StatCard = ({ title, value, subtitle, icon: Icon, color, badge, badgeLoading }) => (
    <div className={`
        bg-[var(--theme-bg-card)] p-5 rounded-2xl border border-[var(--theme-border)]
        hover:border-${color}-500/30 transition-all duration-300
        hover:shadow-lg group animate-fade-in
    `}>
        <div className="flex items-start justify-between mb-3">
            <div className={`p-2.5 rounded-xl bg-${color}-500/10`}>
                <Icon size={20} className={`text-${color}-400`} />
            </div>
            {/* Badge slot — can be a ReactNode (GrowthBadge) or string */}
            {badge}
        </div>
        <p className="text-xs text-[var(--theme-text-muted)] uppercase font-bold tracking-widest mb-1">{title}</p>
        <p className="text-2xl md:text-3xl font-bold text-[var(--theme-text-main)] truncate">{value}</p>
        {subtitle && <p className="text-xs text-[var(--theme-text-subtle)] mt-1">{subtitle}</p>}
    </div>
);

/* ── Status Badge ────────────────────────────────────────────────────────── */
const statusColors = {
    completed: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    pending: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    preparing: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    accepted: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    ready: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const AdminDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    // Growth state
    const [growth, setGrowth] = useState(null);
    const [growthLoading, setGrowthLoading] = useState(true);

    const PER_PAGE = 10;
    const { user, socket, formatPrice, settings } = useContext(AuthContext);

    /* ── Fetch Orders ─────────────────────────────────────────────────── */
    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // res.data is { orders, pagination }
            setOrders(res.data.orders || []);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    /* ── Fetch Growth ─────────────────────────────────────────────────── */
    const fetchGrowth = useCallback(async () => {
        // Only fetch for admin role
        if (user?.role !== 'admin') return;
        setGrowthLoading(true);
        try {
            const res = await api.get('/api/dashboard/growth', {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setGrowth(res.data.growth ?? 0);
        } catch (err) {
            console.error('[AdminDashboard] Growth fetch failed:', err.message);
            setGrowth(null); // silently fail — badge disappears
        } finally {
            setGrowthLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOrders();
        fetchGrowth();

        if (socket) {
            const onNew = (o) => setOrders(p => [o, ...p]);
            const onUpdate = (o) => setOrders(p => p.map(x => x._id === o._id ? o : x));
            socket.on('new-order', onNew);
            socket.on('order-updated', onUpdate);
            socket.on('order-completed', onUpdate);
            socket.on('orderCancelled', onUpdate);
            return () => {
                socket.off('new-order', onNew);
                socket.off('order-updated', onUpdate);
                socket.off('order-completed', onUpdate);
                socket.off('orderCancelled', onUpdate);
            };
        }
    }, [user, socket, fetchOrders, fetchGrowth]);

    /* ── Derived Stats ───────────────────────────────────────────────── */
    const stats = useMemo(() => {
        const completed = orders.filter(o => o.orderStatus === 'completed');
        const active = orders.filter(o => !['completed', 'cancelled'].includes(o.orderStatus));
        const pending = orders.filter(o => o.orderStatus === 'pending');
        const revenue = completed.reduce((s, o) => s + (o.finalAmount || 0), 0);
        const avg = completed.length ? revenue / completed.length : 0;
        return { completed, active, pending, revenue, avg, total: orders.length };
    }, [orders]);

    /* ── Pagination ──────────────────────────────────────────────────── */
    const paginated = useMemo(() => {
        const start = (page - 1) * PER_PAGE;
        return orders.slice(start, start + PER_PAGE);
    }, [orders, page]);
    const totalPages = Math.ceil(orders.length / PER_PAGE);

    /* ── CSV Download ────────────────────────────────────────────────── */
    const downloadReport = () => {
        if (!orders.length) { alert('No data to download'); return; }
        const headers = ['Order Number,Date,Time,Type,Items,Status,Payment,Total'];
        const rows = orders.map(o => {
            const d = new Date(o.createdAt);
            return `${o.orderNumber},${d.toLocaleDateString()},${d.toLocaleTimeString()},${o.orderType},${o.items.length},${o.orderStatus},${o.paymentStatus},${o.finalAmount}`;
        });
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Handle Refresh (both orders + growth) ───────────────────────── */
    const handleRefresh = () => {
        fetchOrders();
        fetchGrowth();
    };

    return (
        <div className="space-y-5 animate-fade-in">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--theme-bg-card2)] rounded-2xl p-5 border border-[var(--theme-border)]">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-[var(--theme-text-main)] leading-tight">
                        {settings?.restaurantName}
                        <span className="text-[var(--theme-text-muted)] font-normal ml-2 text-base md:text-xl">Analytics</span>
                    </h1>
                    <p className="text-sm text-[var(--theme-text-subtle)] mt-0.5">Multi-Branch Performance Overview</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border border-[var(--theme-border)] rounded-xl text-sm font-medium transition-colors min-h-[44px]"
                    >
                        <RefreshCw size={15} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={downloadReport}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-glow-orange min-h-[44px]"
                    >
                        <Download size={15} />
                        <span>Report</span>
                    </button>
                </div>
            </div>

            {/* ── Stats Grid ──────────────────────────────────────────── */}
            {/* Mobile: 1-col → sm: 2-col → lg: 4-col */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                    <>
                        {/* Total Revenue — real growth badge from API */}
                        <StatCard
                            title="Total Revenue"
                            value={formatPrice(stats.revenue)}
                            subtitle={`${stats.completed.length} completed orders`}
                            icon={DollarSign}
                            color="orange"
                            badge={
                                <div className="flex flex-col items-end gap-0.5">
                                    <GrowthBadge growth={growth} loading={growthLoading} />
                                    {!growthLoading && growth !== null && (
                                        <span className="text-[9px] text-[var(--theme-text-subtle)]">vs yesterday</span>
                                    )}
                                </div>
                            }
                        />
                        <StatCard
                            title="Active Orders"
                            value={stats.active.length}
                            subtitle="Currently in progress"
                            icon={ShoppingBag}
                            color="blue"
                            badge={
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                                    Live
                                </span>
                            }
                        />
                        <StatCard
                            title="Pending KOTs"
                            value={stats.pending.length}
                            subtitle="Awaiting kitchen"
                            icon={Clock}
                            color="amber"
                            badge={null}
                        />
                        <StatCard
                            title="Avg Order Value"
                            value={formatPrice(stats.avg)}
                            subtitle={`${stats.total} total orders`}
                            icon={TrendingUp}
                            color="emerald"
                            badge={null}
                        />
                    </>
                )}
            </div>

            {/* ── Orders Table ────────────────────────────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-[var(--theme-text-main)]">Recent Orders</h2>
                        <p className="text-xs text-[var(--theme-text-subtle)] mt-0.5">{orders.length} total records</p>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-xl text-xs font-medium transition-colors min-h-[44px]">
                            Filter <ChevronDown size={13} />
                        </button>
                    </div>
                </div>

                {/* Scrollable table container */}
                <div className="table-wrap">
                    {loading ? (
                        <div className="p-6 space-y-3">
                            {Array(5).fill(0).map((_, i) => (
                                <div key={i} className="skeleton h-10 rounded-lg" />
                            ))}
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                            <ShoppingBag size={48} className="mb-3 opacity-20" />
                            <p className="font-medium">No orders yet</p>
                            <p className="text-sm">Orders will appear here as they come in</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-[var(--theme-text-muted)] min-w-[600px]">
                            <thead className="bg-[var(--theme-bg-hover)] text-[var(--theme-text-subtle)] text-xs uppercase font-semibold tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5">Order ID</th>
                                    <th className="px-5 py-3.5">Type</th>
                                    <th className="px-5 py-3.5 hidden sm:table-cell">Items</th>
                                    <th className="px-5 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 hidden md:table-cell">Date</th>
                                    <th className="px-5 py-3.5 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--theme-border)]">
                                {paginated.map(order => (
                                    <tr key={order._id} className="hover:bg-[var(--theme-bg-hover)] transition-colors">
                                        <td className="px-5 py-3.5 font-semibold text-[var(--theme-text-main)] whitespace-nowrap">
                                            {order.orderNumber}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`badge ${order.orderType === 'dine-in' ? 'badge-accepted' : 'badge-preparing'}`}>
                                                {order.orderType}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell">
                                            {order.items?.length || 0} items
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap ${statusColors[order.orderStatus] || ''}`}>
                                                {order.orderStatus}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap hidden md:table-cell">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-bold text-[var(--theme-text-main)] whitespace-nowrap">
                                            {formatPrice(order.finalAmount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-xl text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

export default AdminDashboard;
