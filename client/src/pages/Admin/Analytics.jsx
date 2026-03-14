import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, Award, Clock, ChefHat, Download, RefreshCw, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ── Analytics Module ─────────────────────────────────────────────────── */

const Analytics = () => {
    const { socket, formatPrice } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [summary, setSummary] = useState({ totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
    const [growth, setGrowth] = useState(0);
    const [heatmap, setHeatmap] = useState([]);
    const [waiters, setWaiters] = useState([]);
    const [kitchen, setKitchen] = useState([]);
    const [reportRange, setReportRange] = useState('today');
    const [reportData, setReportData] = useState([]);
    const [items, setItems] = useState([]);

    const dashboardRef = useRef(null);
    // Keep a ref so socket callbacks always see the latest range
    const reportRangeRef = useRef(reportRange);
    useEffect(() => { reportRangeRef.current = reportRange; }, [reportRange]);

    const fetchAllData = async (range, forceRefresh = false) => {
        const r = range ?? reportRangeRef.current;
        setRefreshing(true);
        const refreshQuery = forceRefresh ? '&refresh=true' : '';
        try {
            const [sumRes, heatRes, waitRes, kitRes, repRes, groRes, itemRes] = await Promise.allSettled([
                api.get(`/api/analytics/summary?range=${r}${refreshQuery}`),
                api.get(`/api/analytics/heatmap?type=hourly&range=${r}${refreshQuery}`),
                api.get(`/api/analytics/waiters?range=${r}${refreshQuery}`),
                api.get(`/api/analytics/kitchen?range=${r}${refreshQuery}`),
                api.get(`/api/analytics/report?range=${r}${refreshQuery}`),
                api.get('/api/dashboard/growth'),
                api.get(`/api/analytics/items?range=${r}${refreshQuery}`),
            ]);
            if (sumRes.status  === 'fulfilled') setSummary(sumRes.value.data);
            else console.error('summary failed:', sumRes.reason?.message);
            if (heatRes.status === 'fulfilled') setHeatmap(heatRes.value.data);
            else console.error('heatmap failed:', heatRes.reason?.message);
            if (waitRes.status === 'fulfilled') setWaiters(waitRes.value.data);
            else console.error('waiters failed:', waitRes.reason?.message);
            if (kitRes.status  === 'fulfilled') setKitchen(kitRes.value.data);
            else console.error('kitchen failed:', kitRes.reason?.message);
            if (repRes.status  === 'fulfilled') setReportData(repRes.value.data);
            else console.error('report failed:', repRes.reason?.message);
            if (groRes.status  === 'fulfilled') setGrowth(groRes.value.data.growth);
            else console.error('growth failed:', groRes.reason?.message);
            if (itemRes.status === 'fulfilled') setItems(itemRes.value.data);
            else console.error('items failed:', itemRes.reason?.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // When range button is clicked, refetch summary + report together
    const handleRangeChange = (r) => {
        setReportRange(r);
        fetchAllData(r, true);
    };

    useEffect(() => {
        fetchAllData('today', true);

        if (socket) {
            const refresh = () => fetchAllData(null, true);
            socket.on('new-order', refresh);
            socket.on('order-updated', refresh);
            socket.on('order-completed', refresh);
            socket.on('payment-success', refresh);

            return () => {
                socket.off('new-order', refresh);
                socket.off('order-updated', refresh);
                socket.off('order-completed', refresh);
                socket.off('payment-success', refresh);
            };
        }
    }, [socket]);

    /* ── PDF Export ──────────────────────────────────────────────────── */
    const exportPDF = async () => {
        const element = dashboardRef.current;
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
        pdf.text(`Kagzso Analytics Report - ${reportRange.toUpperCase()}`, 10, 15);
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 22);
        const summaryTotal = items.reduce((acc, curr) => acc + curr.totalRevenue, 0);
        const ordersTotal = items.reduce((acc, curr) => acc + curr.totalOrders, 0);
        pdf.text(`Total Revenue: ${formatPrice(summaryTotal)} | Items Sold: ${ordersTotal}`, 10, 28);
        pdf.addImage(imgData, 'PNG', 0, 35, pdfWidth, pdfHeight);
        pdf.save(`Kagzso_Report_${reportRange}_${new Date().toISOString().split('T')[0]}.pdf`);
    };



    const tooltipStyle = {
        contentStyle: {
            backgroundColor: 'var(--theme-bg-card)',
            borderColor: 'var(--theme-border)',
            borderRadius: '12px',
            fontSize: '12px',
            color: 'var(--theme-text-main)',
        },
        itemStyle: { color: 'var(--theme-text-main)' },
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[var(--theme-text-subtle)] text-sm font-bold animate-pulse uppercase tracking-widest">Generating Insights...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in" ref={dashboardRef}>
            {/* ── Header ────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--theme-bg-card)] p-5 rounded-2xl border border-[var(--theme-border)]">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--theme-text-main)]">Business Analytics</h1>
                    <p className="text-sm text-[var(--theme-text-muted)] mt-1">Real-time performance metrics and revenue insights</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-[var(--theme-bg-hover)] p-1 rounded-xl border border-[var(--theme-border)]">
                        {['today', 'week', 'month', 'year'].map(r => (
                            <button
                                key={r}
                                onClick={() => handleRangeChange(r)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                    ${reportRange === r
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)]'
                                    }
                                `}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchAllData(null, true)}
                        className="p-2.5 bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-orange-500 rounded-xl transition-all border border-[var(--theme-border)] hover:border-orange-500/50 active:scale-95 shadow-sm"
                        disabled={refreshing}
                        title="Refresh all data"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-bold transition-all shadow-glow-orange active:scale-95"
                    >
                        <Download size={18} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* ── Summary Stats ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Total Revenue" value={formatPrice(summary.totalRevenue)} icon={TrendingUp} color="orange" />
                <SummaryCard title="Orders Handled" value={summary.orderCount} icon={FileText} color="blue" />
                <SummaryCard title="Avg Order Value" value={formatPrice(summary.avgOrderValue)} icon={Award} color="emerald" />
                <SummaryCard
                    title="Revenue Growth"
                    value={`${growth >= 0 ? '+' : ''}${growth}%`}
                    icon={TrendingUp}
                    color="purple"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Revenue & Order Trends ────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={20} className="text-blue-400" />
                            Revenue &amp; Order Trends
                        </div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] bg-[var(--theme-bg-hover)] px-2 py-1 rounded-lg uppercase tracking-widest font-bold">
                            {reportRange}
                        </span>
                    </h3>
                    <div className="h-[300px]">
                        {reportData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[var(--theme-text-muted)] text-sm italic">
                                No revenue data for this period.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <AreaChart data={reportData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOrd" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-border)" />
                                    <XAxis dataKey="label" stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={60} />
                                    <YAxis yAxisId="right" orientation="right" stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} width={30} />
                                    <Tooltip {...tooltipStyle} formatter={(val, name) => name === 'Revenue' ? formatPrice(val) : val} />
                                    <Legend />
                                    <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#colorRev)" strokeWidth={3} fillOpacity={1} />
                                    <Area yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#f97316" fill="url(#colorOrd)" strokeWidth={2} fillOpacity={1} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Waiter Ranking ─────────────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <Award size={20} className="text-orange-400" />
                        Waiter Productivity Ranking
                    </h3>
                    <div className="h-[300px]">
                        {waiters.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[var(--theme-text-muted)] text-sm italic">
                                No completed orders yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={waiters} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--theme-border)" />
                                    <XAxis
                                        type="number"
                                        stroke="var(--theme-text-muted)"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                        domain={[0, 'dataMax']}
                                    />
                                    <YAxis dataKey="waiterName" type="category" stroke="var(--theme-text-muted)" width={70} fontSize={11} />
                                    <Tooltip {...tooltipStyle} formatter={(v, name) => name === 'Revenue' ? formatPrice(v) : v} />
                                    <Legend />
                                    <Bar dataKey="totalRevenue" name="Revenue" fill="#f97316" radius={[0, 4, 4, 0]} barSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Kitchen Performance ─────────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <ChefHat size={20} className="text-emerald-400" />
                        Kitchen Prep Time Trends (min)
                    </h3>
                    <div className="h-[300px]">
                        {kitchen.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[var(--theme-text-muted)] text-sm italic">
                                No kitchen data yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <LineChart data={kitchen} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-border)" />
                                    <XAxis dataKey="label" stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--theme-text-muted)" fontSize={10} tickFormatter={(v) => `${v}m`} />
                                    <Tooltip {...tooltipStyle} formatter={(v, name) => [`${(parseFloat(v) || 0).toFixed(1)}${name === 'Delay %' ? '%' : ' min'}`, name]} />
                                    <Legend />
                                    <Line type="monotone" dataKey="avgPrepTime" name="Avg Prep (min)" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                                    <Line type="monotone" dataKey="delayRate" name="Delay %" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#ef4444', r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Hourly Revenue Distribution ─────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-400" />
                        Hourly Revenue Distribution
                    </h3>
                    <div className="h-[300px]">
                        {heatmap.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-[var(--theme-text-muted)] text-sm italic">
                                No hourly data yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={heatmap} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-border)" />
                                    {/* MySQL returns "hour" directly (not "_id.hour" like MongoDB) */}
                                    <XAxis dataKey="hour" stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(h) => `${h}:00`} />
                                    <YAxis stroke="var(--theme-text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={55} />
                                    <Tooltip {...tooltipStyle} formatter={(v) => [formatPrice(v), 'Revenue']} />
                                    <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Detailed Performance Summary (per menu item) ─── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="p-5 border-b border-[var(--theme-border)] flex items-center justify-between">
                    <h3 className="font-bold text-[var(--theme-text-main)] flex items-center gap-2">
                        <FileText size={18} className="text-orange-400" />
                        Detailed Performance Summary
                    </h3>
                    <span className="text-xs font-bold text-[var(--theme-text-muted)]">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4 font-bold">Item Name</th>
                                <th className="px-6 py-4 font-bold text-right">Qty Sold</th>
                                <th className="px-6 py-4 font-bold text-right">Total Revenue</th>
                                <th className="px-6 py-4 font-bold text-right">Avg Prep Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border)]">
                            {items.map((row, idx) => (
                                <tr key={idx} className="hover:bg-[var(--theme-bg-hover)] transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-main)]">
                                        {row.itemName}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-main)] text-right">
                                        {row.totalOrders}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-orange-400 text-right">
                                        {formatPrice(row.totalRevenue)}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-muted)] text-right">
                                        {row.avgPrepTime > 0 ? `${row.avgPrepTime.toFixed(1)} min` : '—'}
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-[var(--theme-text-muted)] text-sm italic">
                                        No orders available for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {items.length > 0 && (
                            <tfoot className="bg-[var(--theme-bg-dark)] font-bold">
                                <tr>
                                    <td className="px-6 py-4 text-[var(--theme-text-main)]">Grand Total</td>
                                    <td className="px-6 py-4 text-[var(--theme-text-main)] text-right">
                                        {items.reduce((acc, r) => acc + r.totalOrders, 0)}
                                    </td>
                                    <td className="px-6 py-4 text-orange-400 text-right">
                                        {formatPrice(items.reduce((acc, r) => acc + r.totalRevenue, 0))}
                                    </td>
                                    <td className="px-6 py-4 text-[var(--theme-text-muted)] text-right">
                                        {(() => {
                                            const valid = items.filter(r => r.avgPrepTime > 0);
                                            if (!valid.length) return '—';
                                            return `${(valid.reduce((acc, r) => acc + r.avgPrepTime, 0) / valid.length).toFixed(1)} min`;
                                        })()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-[var(--theme-bg-card)] p-5 rounded-2xl border border-[var(--theme-border)] hover:border-orange-500/30 transition-all group">
        <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl bg-${color}-500/10`}>
                <Icon size={20} className={`text-${color}-400`} />
            </div>
            <div className="bg-[var(--theme-bg-hover)] px-2 py-1 rounded-lg">
                <p className="text-[10px] font-bold text-[var(--theme-text-muted)] tracking-wider">LIVE</p>
            </div>
        </div>
        <p className="text-[10px] font-bold text-[var(--theme-text-muted)] uppercase tracking-[0.2em] mb-1">{title}</p>
        <p className="text-2xl font-black text-[var(--theme-text-main)] group-hover:text-orange-400 transition-colors">
            {value}
        </p>
    </div>
);

export default Analytics;
