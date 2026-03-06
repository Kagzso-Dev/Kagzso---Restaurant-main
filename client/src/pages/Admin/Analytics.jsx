import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import {
    TrendingUp, Award, Clock, ChefHat, Building2, Download,
    RefreshCw, Calendar, ChevronRight, Filter, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ── Analytics Module ─────────────────────────────────────────────────── */

const Analytics = () => {
    const { user, socket, formatPrice } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState('30days');

    // Data states
    const [summary, setSummary] = useState({ totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
    const [growth, setGrowth] = useState(0);
    const [heatmap, setHeatmap] = useState([]);
    const [waiters, setWaiters] = useState([]);
    const [kitchen, setKitchen] = useState([]);
    const [branches, setBranches] = useState([]);
    const [reportRange, setReportRange] = useState('today');
    const [reportData, setReportData] = useState([]);

    const dashboardRef = useRef(null);

    const fetchAllData = async () => {
        setRefreshing(true);
        try {
            const [sumRes, heatRes, waitRes, kitRes, repRes, groRes] = await Promise.all([
                api.get('/api/analytics/summary'),
                api.get('/api/analytics/heatmap?type=hourly'),
                api.get('/api/analytics/waiters'),
                api.get('/api/analytics/kitchen'),
                api.get(`/api/analytics/report?range=${reportRange}`),
                api.get('/api/dashboard/growth')
            ]);
            setSummary(sumRes.data);
            setHeatmap(heatRes.data);
            setWaiters(waitRes.data);
            setKitchen(kitRes.data);
            setReportData(repRes.data);
            setGrowth(groRes.data.growth);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchOnlyReport = async (range) => {
        try {
            const res = await api.get(`/api/analytics/report?range=${range}`);
            setReportData(res.data);
        } catch (err) {
            console.error('Failed to fetch report:', err);
        }
    };

    useEffect(() => {
        if (!loading) fetchOnlyReport(reportRange);
    }, [reportRange]);

    useEffect(() => {
        fetchAllData();

        if (socket) {
            const refresh = () => fetchAllData();
            socket.on('new-order', refresh);
            socket.on('order-updated', refresh);
            socket.on('order-completed', refresh);
            socket.on('payment-completed', refresh); // Future proofing

            return () => {
                socket.off('new-order', refresh);
                socket.off('order-updated', refresh);
                socket.off('order-completed', refresh);
                socket.off('payment-completed', refresh);
            };
        }
    }, [socket]);

    /* ── PDF Export ──────────────────────────────────────────────────── */
    const exportPDF = async () => {
        const element = dashboardRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: 'var(--theme-bg-deep)',
            logging: false,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Add Header Info manually for professional look
        pdf.setFontSize(18);
        pdf.setTextColor(249, 115, 22); // Orange
        pdf.text(`Kagzso Analytics Report - ${reportRange.toUpperCase()}`, 10, 15);

        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 22);

        const summaryTotal = reportData.reduce((acc, curr) => acc + curr.revenue, 0);
        const ordersTotal = reportData.reduce((acc, curr) => acc + curr.orders, 0);

        pdf.text(`Total Revenue: ${formatPrice(summaryTotal)} | Total Orders: ${ordersTotal}`, 10, 28);

        pdf.addImage(imgData, 'PNG', 0, 35, pdfWidth, pdfHeight);
        pdf.save(`Kagzso_Report_${reportRange}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    /* ── Render Helpers ─────────────────────────────────────────────── */
    const COLORS = ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
                    {/* Range Selector */}
                    <div className="flex items-center gap-1 bg-[var(--theme-bg-hover)] p-1 rounded-xl border border-[var(--theme-border)]">
                        {['today', 'week', 'month', 'year'].map(r => (
                            <button
                                key={r}
                                onClick={() => setReportRange(r)}
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
                        onClick={fetchAllData}
                        className="p-2.5 bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] rounded-xl transition-colors border border-[var(--theme-border)]"
                        disabled={refreshing}
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-all shadow-glow-orange"
                    >
                        <Download size={18} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* ── Summary Stats ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Revenue"
                    value={formatPrice(summary.totalRevenue)}
                    icon={TrendingUp}
                    color="orange"
                />
                <SummaryCard
                    title="Orders Handled"
                    value={summary.orderCount}
                    icon={FileText}
                    color="blue"
                />
                <SummaryCard
                    title="Avg Order Value"
                    value={formatPrice(summary.avgOrderValue)}
                    icon={Award}
                    color="emerald"
                />
                <SummaryCard
                    title="Revenue Growth"
                    value={`${growth >= 0 ? '+' : ''}${growth}%`}
                    icon={TrendingUp}
                    color="purple"
                    trend={growth >= 0 ? 'up' : 'down'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ── Dynamic Revenue Report ────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={20} className="text-blue-400" />
                            Revenue & Order Trends
                        </div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] bg-[var(--theme-bg-hover)] px-2 py-1 rounded-lg uppercase tracking-widest font-bold">
                            {reportRange}
                        </span>
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <AreaChart data={reportData}>
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
                                <XAxis
                                    dataKey="label"
                                    stroke="var(--theme-text-muted)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="var(--theme-text-muted)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `₹${v}`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="var(--theme-text-muted)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--theme-bg-card)',
                                        borderColor: 'var(--theme-border)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: 'var(--theme-text-main)'
                                    }}
                                    itemStyle={{ color: 'var(--theme-text-main)' }}
                                    formatter={(val, name) => name === 'revenue' ? formatPrice(val) : val}
                                />
                                <Legend />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="revenue"
                                    name="Revenue"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorRev)"
                                    strokeWidth={3}
                                />
                                <Area
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="orders"
                                    name="Orders"
                                    stroke="#f97316"
                                    fillOpacity={1}
                                    fill="url(#colorOrd)"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Waiter Ranking ─────────────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <Award size={20} className="text-orange-400" />
                        Waiter Productivity Ranking
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={waiters} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="waiterName" type="category" stroke="var(--theme-text-muted)" width={80} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)', borderRadius: '12px', color: 'var(--theme-text-main)' }}
                                    itemStyle={{ color: 'var(--theme-text-main)' }}
                                    formatter={(v, name) => name === 'totalRevenue' ? formatPrice(v) : v}
                                />
                                <Bar dataKey="totalRevenue" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Kitchen Performance ─────────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <ChefHat size={20} className="text-emerald-400" />
                        Kitchen Prep Time Trends (min)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={kitchen}>
                                <XAxis dataKey="hour" stroke="var(--theme-text-muted)" tickFormatter={(h) => `${h}:00`} />
                                <YAxis stroke="var(--theme-text-muted)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)', borderRadius: '12px', color: 'var(--theme-text-main)' }}
                                    itemStyle={{ color: 'var(--theme-text-main)' }}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-border)" />
                                <Line type="monotone" dataKey="avgPrepTime" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
                                <Line type="monotone" dataKey="delayRate" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Delay %" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ── Peak Hours Heatmap ─────────────────────────── */}
                <div className="bg-[var(--theme-bg-card)] p-6 rounded-2xl border border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)] mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-400" />
                        Hourly Revenue Distribution
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={heatmap}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-border)" />
                                <XAxis dataKey="_id.hour" stroke="var(--theme-text-muted)" tickFormatter={(h) => `${h}:00`} />
                                <YAxis stroke="var(--theme-text-muted)" tickFormatter={(v) => `₹${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--theme-bg-card)', borderColor: 'var(--theme-border)', borderRadius: '12px', color: 'var(--theme-text-main)' }}
                                    itemStyle={{ color: 'var(--theme-text-main)' }}
                                    formatter={(v) => formatPrice(v)}
                                />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Detailed Report Summary Table ────────────────── */}
            <div className="bg-[var(--theme-bg-card)] rounded-2xl border border-[var(--theme-border)] overflow-hidden">
                <div className="p-5 border-b border-[var(--theme-border)] flex items-center justify-between">
                    <h3 className="font-bold text-[var(--theme-text-main)] flex items-center gap-2">
                        <FileText size={18} className="text-orange-400" />
                        Detailed Performance Summary
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="text-[var(--theme-text-muted)]">Items: {reportData.length}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4 font-bold">Period / Label</th>
                                <th className="px-6 py-4 font-bold text-right">Revenue</th>
                                <th className="px-6 py-4 font-bold text-right">Order Count</th>
                                <th className="px-6 py-4 font-bold text-right">Avg Order Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border)]">
                            {reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-[var(--theme-bg-hover)] transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-main)]">{row.label}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-orange-400 text-right">{formatPrice(row.revenue)}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-main)] text-right">{row.orders}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--theme-text-muted)] text-right">
                                        {formatPrice(row.orders > 0 ? row.revenue / row.orders : 0)}
                                    </td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-[var(--theme-text-muted)] text-sm italic">
                                        No data available for the selected range.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {reportData.length > 0 && (
                            <tfoot className="bg-[var(--theme-bg-dark)] font-bold">
                                <tr>
                                    <td className="px-6 py-4 text-[var(--theme-text-main)]">Grand Total</td>
                                    <td className="px-6 py-4 text-orange-400 text-right">
                                        {formatPrice(reportData.reduce((acc, curr) => acc + curr.revenue, 0))}
                                    </td>
                                    <td className="px-6 py-4 text-[var(--theme-text-main)] text-right">
                                        {reportData.reduce((acc, curr) => acc + curr.orders, 0)}
                                    </td>
                                    <td className="px-6 py-4 text-[var(--theme-text-main)] text-right">
                                        {formatPrice(reportData.reduce((acc, curr) => acc + curr.revenue, 0) / reportData.reduce((acc, curr) => acc + (curr.orders || 1), 0))}
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
