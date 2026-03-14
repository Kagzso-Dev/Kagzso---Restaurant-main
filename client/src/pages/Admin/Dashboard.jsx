import { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    TrendingUp, TrendingDown, ShoppingBag, Clock, DollarSign,
    Download, RefreshCw, ChevronDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    const [refreshing, setRefreshing] = useState(false);
    // DB-computed stats (from MySQL via /api/dashboard/stats + /api/analytics/summary)
    const [dbStats, setDbStats] = useState(null);
    const [dbSummary, setDbSummary] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const dashboardRef = useRef(null);

    const PER_PAGE = 10;
    const { user, socket, formatPrice, settings } = useContext(AuthContext);

    /* ── Fetch Orders (for the browsable table only) ──────────────────── */
    const fetchOrders = useCallback(async (forceRefresh = false) => {
        try {
            setLoading(true);
            if (forceRefresh) setRefreshing(true);
            const refreshQuery = forceRefresh ? "?refresh=true" : "";
            const res = await api.get(`/api/orders${refreshQuery}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // res.data is { orders, pagination }
            setOrders(res.data.orders || []);
            console.log('[Dashboard] Orders fetched from DB:', res.data.orders?.length ?? 0);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    /* ── Fetch DB Stats — MySQL COUNT/SUM queries via API ─────────────── */
    const fetchStats = useCallback(async (forceRefresh = false) => {
        if (user?.role !== 'admin') return;
        const refreshQuery = forceRefresh ? '?refresh=true' : '';
        try {
            setStatsLoading(true);
            const [statsRes, summaryRes] = await Promise.allSettled([
                // GET /api/dashboard/stats → MySQL: COUNT(*) GROUP BY order_status
                api.get(`/api/dashboard/stats${refreshQuery}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                }),
                // GET /api/analytics/summary → MySQL: SUM(final_amount), AVG(final_amount)
                api.get(`/api/analytics/summary?range=month${refreshQuery}`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                }),
            ]);
            if (statsRes.status === 'fulfilled') {
                console.log('[Dashboard] DB stats from MySQL:', statsRes.value.data);
                setDbStats(statsRes.value.data);
            } else {
                console.error('[Dashboard] stats fetch failed:', statsRes.reason?.message);
            }
            if (summaryRes.status === 'fulfilled') {
                console.log('[Dashboard] DB summary from MySQL:', summaryRes.value.data);
                setDbSummary(summaryRes.value.data);
            } else {
                console.error('[Dashboard] summary fetch failed:', summaryRes.reason?.message);
            }
        } finally {
            setStatsLoading(false);
        }
    }, [user]);

    /* ── Fetch Growth ─────────────────────────────────────────────────── */
    const fetchGrowth = useCallback(async (forceRefresh = false) => {
        // Only fetch for admin role
        if (user?.role !== 'admin') return;
        setGrowthLoading(true);
        const refreshQuery = forceRefresh ? "?refresh=true" : "";
        try {
            const res = await api.get(`/api/dashboard/growth${refreshQuery}`, {
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
        fetchStats();
        fetchGrowth();

        if (socket) {
            const onNew = (o) => {
                setOrders(p => [o, ...p]);
                // Re-fetch MySQL stats whenever a new order comes in
                fetchStats(true);
            };
            const onUpdate = (o) => {
                setOrders(p => p.map(x => x._id === o._id ? o : x));
                fetchStats(true);
            };
            socket.on('new-order', onNew);
            socket.on('order-updated', onUpdate);
            socket.on('order-completed', onUpdate);
            socket.on('orderCancelled', onUpdate);
            socket.on('payment-success', () => fetchStats(true));
            return () => {
                socket.off('new-order', onNew);
                socket.off('order-updated', onUpdate);
                socket.off('order-completed', onUpdate);
                socket.off('orderCancelled', onUpdate);
                socket.off('payment-success', () => fetchStats(true));
            };
        }
    }, [user, socket, fetchOrders, fetchStats, fetchGrowth]);

    /* ── DB-backed stat values (from MySQL via API) ───────────────────── */
    // dbStats.today.active/completed/cancelled/revenue from /api/dashboard/stats
    // dbSummary.totalRevenue/orderCount/avgOrderValue from /api/analytics/summary
    const activeCount   = dbStats?.today?.active    ?? 0;
    const completedCount = dbStats?.today?.completed ?? 0;
    const allTimeCount  = dbStats?.allTime           ?? 0;
    const totalRevenue  = dbSummary?.totalRevenue    ?? 0;
    const avgOrderValue = dbSummary?.avgOrderValue   ?? 0;
    const orderCount    = dbSummary?.orderCount      ?? 0;

    /* ── Pagination ──────────────────────────────────────────────────── */
    const paginated = useMemo(() => {
        const start = (page - 1) * PER_PAGE;
        return orders.slice(start, start + PER_PAGE);
    }, [orders, page]);
    const totalPages = Math.ceil(orders.length / PER_PAGE);

    /* ── PDF Export ──────────────────────────────────────────────────── */
    const exportPDF = async () => {
        const element = dashboardRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#0f172a',
            logging: false,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.setFontSize(18);
        pdf.setTextColor(249, 115, 22);
        pdf.text(`Kagzso Business Dashboard`, 10, 15);
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 22);
        pdf.addImage(imgData, 'PNG', 0, 30, pdfWidth, pdfHeight);
        pdf.save(`Kagzso_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    /* ── Handle Refresh (orders + DB stats + growth) ─────────────────── */
    const handleRefresh = () => {
        fetchOrders(true);
        fetchStats(true);
        fetchGrowth(true);
    };

    return (
        <div className="space-y-5 animate-fade-in" ref={dashboardRef}>

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
                        disabled={refreshing}
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl text-sm font-semibold transition-colors shadow-glow-orange min-h-[44px]"
                    >
                        <Download size={15} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* ── Stats Grid — values sourced from MySQL via API ─────── */}
            {/* Mobile: 1-col → sm: 2-col → lg: 4-col */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsLoading ? (
                    Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                ) : (
                    <>
                        {/* Total Revenue — MySQL: SUM(final_amount) WHERE payment_status='paid' */}
                        <StatCard
                            title="Total Revenue (30d)"
                            value={formatPrice(totalRevenue)}
                            subtitle={`${orderCount} paid order${orderCount !== 1 ? 's' : ''} this month`}
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
                        {/* Active — MySQL: COUNT(*) WHERE order_status IN ('pending','accepted','preparing','ready') */}
                        <StatCard
                            title="Active Orders"
                            value={activeCount}
                            subtitle="Currently in progress"
                            icon={ShoppingBag}
                            color="blue"
                            badge={
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                                    Live
                                </span>
                            }
                        />
                        {/* Completed — MySQL: COUNT(*) WHERE order_status='completed' (today) */}
                        <StatCard
                            title="Completed Today"
                            value={completedCount}
                            subtitle={`${allTimeCount} total all-time`}
                            icon={Clock}
                            color="amber"
                            badge={null}
                        />
                        {/* Avg — MySQL: AVG(final_amount) WHERE payment_status='paid' */}
                        <StatCard
                            title="Avg Order Value"
                            value={formatPrice(avgOrderValue)}
                            subtitle="30-day average"
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
