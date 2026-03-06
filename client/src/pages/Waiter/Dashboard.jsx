import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { Utensils, Package, Grid, ShoppingBag, Clock, XCircle, History } from 'lucide-react';
import TableGrid from '../../components/TableGrid';
import CancelOrderModal from '../../components/CancelOrderModal';
import OrderDetailsModal from '../../components/OrderDetailsModal';
import StatusBadge from '../../components/StatusBadge';
import { tokenColors } from '../../utils/tokenColors';

/* ── Status colors ───────────────────────────────────────────────────────── */
const statusStyle = {
    ready: { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    preparing: { bar: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    pending: { bar: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    accepted: { bar: 'bg-indigo-500', badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
    cancelled: { bar: 'bg-red-500', badge: 'bg-red-500/15 text-red-500 border-red-500/25' },
};

/* ── Order Card ──────────────────────────────────────────────────────────── */
const OrderCard = ({ order, formatPrice, onCancel }) => {
    const s = statusStyle[order.orderStatus] || statusStyle.pending;
    const tColor = tokenColors[order.orderStatus] || 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] text-[var(--theme-text-main)]';
    const isReady = order.orderStatus?.toLowerCase() === 'ready';

    return (
        <div className={`
            ${tColor} ${isReady ? 'animate-pulse' : ''}
            p-5 rounded-xl border-l-8 shadow-md transition-all duration-300 flex flex-col group tap-scale
        `}>
            <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0 text-left">
                        <h3 className="font-bold text-inherit text-base truncate">{order.orderNumber}</h3>
                        <p className="text-[10px] text-inherit opacity-70 uppercase tracking-widest font-semibold mt-0.5">
                            {order.orderType === 'dine-in' ? `Table ${order.tableId?.number || order.tableId || '?'}` : `Token ${order.tokenNumber}`}
                        </p>
                    </div>
                    <StatusBadge status={order.orderStatus} />
                </div>

                <p className="text-sm text-inherit opacity-80 line-clamp-2 flex-1 text-left">
                    {order.items?.map(i => `${i.quantity}× ${i.name}`).join(', ') || 'No items'}
                </p>

                {order.orderStatus === 'cancelled' && (
                    <div className="mt-2 text-[10px] text-red-400/80 italic text-left">
                        Cancelled by {order.cancelledBy}: {order.cancelReason}
                    </div>
                )}

                <div className="flex justify-between items-center border-t border-black/5 mt-3 pt-3">
                    <div className="flex items-center gap-1 text-xs text-inherit opacity-60">
                        <Clock size={11} />
                        {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-3">
                        {order.orderStatus === 'pending' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(order); }}
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Cancel Order"
                            >
                                <XCircle size={16} />
                            </button>
                        )}
                        <span className="font-bold text-inherit">{formatPrice(order.finalAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Main Component ───────────────────────────────────────────────────────── */
const WaiterDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [tables, setTables] = useState([]);
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'cancelled'
    const [showTables, setShowTables] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cancelModal, setCancelModal] = useState({ isOpen: false, order: null, item: null });
    const { user, socket, formatPrice } = useContext(AuthContext);
    const navigate = useNavigate();

    // ── Reserve a table manually from the Table Map ───────────────────────────
    const handleReserveTable = useCallback(async (tableId) => {
        try {
            const res = await api.put(
                `/api/tables/${tableId}/reserve`,
                {},
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setTables(prev => prev.map(t => t._id === tableId ? res.data : t));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reserve table');
        }
    }, [user]);

    // ── Cancel a reservation from the Table Map ───────────────────────────────
    const handleCancelReservation = useCallback(async (tableId) => {
        try {
            const res = await api.put(
                `/api/tables/${tableId}/release`,
                {},
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setTables(prev => prev.map(t => t._id === tableId ? res.data : t));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel reservation');
        }
    }, [user]);

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setOrders(res.data.orders || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) fetchOrders();

        if (socket) {
            const onNew = (o) => setOrders(p => {
                if (p.find(x => x._id === o._id)) return p;
                return [o, ...p];
            });
            const onUpdate = (o) => {
                setOrders(p => p.map(x => x._id === o._id ? o : x));
                if (selectedOrder?._id === o._id) setSelectedOrder(o);
            };

            socket.on('new-order', onNew);
            socket.on('order-updated', onUpdate);
            socket.on('orderCancelled', onUpdate);
            socket.on('itemUpdated', onUpdate); // Listen for item cancellation

            return () => {
                socket.off('new-order', onNew);
                socket.off('order-updated', onUpdate);
                socket.off('orderCancelled', onUpdate);
                socket.off('itemUpdated', onUpdate);
            };
        }
    }, [user, socket, fetchOrders, selectedOrder]);

    const handleCancelAction = async (orderId, arg2, arg3) => {
        try {
            const isItem = arg3 !== undefined;
            const url = isItem
                ? `/api/orders/${orderId}/items/${arg2}/cancel`
                : `/api/orders/${orderId}/cancel`;
            const reason = isItem ? arg3 : arg2;

            await api.put(url, { reason }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
        } catch (err) {
            alert(err.response?.data?.message || "Action failed");
        }
    };

    const counts = {
        pending: orders.filter(o => o.orderStatus === 'pending').length,
        preparing: orders.filter(o => o.orderStatus === 'preparing' || o.orderStatus === 'accepted').length,
        ready: orders.filter(o => o.orderStatus === 'ready').length,
        cancelled: orders.filter(o => o.orderStatus === 'cancelled').length,
    };

    const filteredOrders = activeTab === 'active'
        ? orders.filter(o => !['completed', 'cancelled'].includes(o.orderStatus))
        : orders.filter(o => o.orderStatus === 'cancelled');

    return (
        <div className="space-y-5 animate-fade-in pb-10 text-left">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-bg-card2)] rounded-2xl p-4 sm:p-5 border border-[var(--theme-border)]">
                <div>
                    <h1 className="text-xl font-bold text-[var(--theme-text-main)]">Waiter Console</h1>
                    <p className="text-sm text-[var(--theme-text-subtle)] mt-0.5">Manage live service and KOTs</p>
                </div>
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowTables(t => !t)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all min-h-[44px]
                            ${showTables
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border border-[var(--theme-border)]'
                            }
                        `}
                    >
                        <Grid size={17} />
                        <span>Table Map</span>
                    </button>
                    <button
                        onClick={() => navigate('/dine-in')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 hover:scale-105 text-white rounded-xl font-bold text-sm transition-all shadow-glow-orange min-h-[44px]"
                    >
                        <Utensils size={17} />
                        <span>Dine In</span>
                    </button>
                    <button
                        onClick={() => navigate('/take-away')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 hover:scale-105 text-white rounded-xl font-bold text-sm transition-all min-h-[44px]"
                    >
                        <Package size={17} />
                        <span>Take Away</span>
                    </button>
                </div>
            </div>

            {/* ── Tabs & Counters ─────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 p-1.5 bg-[var(--theme-bg-hover)] rounded-2xl border border-[var(--theme-border)] w-full sm:w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)]'}`}
                    >
                        <ShoppingBag size={16} />
                        Active ({counts.pending + counts.preparing + counts.ready})
                    </button>
                    <button
                        onClick={() => setActiveTab('cancelled')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'cancelled' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)]'}`}
                    >
                        <History size={16} />
                        Cancelled ({counts.cancelled})
                    </button>
                </div>

                {activeTab === 'active' && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-2 sm:px-4 py-3 text-center">
                            <p className="text-xl sm:text-2xl font-black text-blue-400">{counts.pending}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-500 tracking-widest">Pending</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-2 sm:px-4 py-3 text-center">
                            <p className="text-xl sm:text-2xl font-black text-amber-400">{counts.preparing}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-500 tracking-widest">Cooking</p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2 sm:px-4 py-3 text-center">
                            <p className="text-xl sm:text-2xl font-black text-emerald-400">{counts.ready}</p>
                            <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-500 tracking-widest">Ready</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Table Map (collapsible) ──────────────────────────── */}
            {showTables && (
                <div className="bg-[var(--theme-bg-card)] p-4 sm:p-5 rounded-2xl border border-[var(--theme-border)] animate-fade-in">
                    <h2 className="text-base font-bold text-[var(--theme-text-main)] mb-4">Table Status Overview</h2>
                    <TableGrid
                        allowedStatuses={['available']}
                        showCleanAction={true}
                        onSelectTable={() => navigate('/waiter/new-order')}
                        onReserve={handleReserveTable}
                        onCancelReservation={handleCancelReservation}
                    />
                </div>
            )}

            {/* ── Orders Grid ─────────────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton rounded-2xl h-48" />)}
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--theme-text-subtle)]">
                    {activeTab === 'active' ? (
                        <>
                            <ShoppingBag size={52} className="mb-3 opacity-20" />
                            <h3 className="text-lg font-bold text-[var(--theme-text-muted)]">No active orders</h3>
                            <p className="text-sm mt-1">Tap "New Order" to create one</p>
                        </>
                    ) : (
                        <>
                            <History size={52} className="mb-3 opacity-20" />
                            <h3 className="text-lg font-bold text-[var(--theme-text-muted)]">No cancelled orders</h3>
                            <p className="text-sm mt-1">Hooray! No wastage today.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrders.map(order => (
                        <div key={order._id} onClick={() => setSelectedOrder(order)} className="cursor-pointer">
                            <OrderCard
                                order={order}
                                formatPrice={formatPrice}
                                onCancel={(o) => setCancelModal({ isOpen: true, order: o, item: null })}
                            />
                        </div>
                    ))}
                </div>
            )}

            <OrderDetailsModal
                isOpen={!!selectedOrder}
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                formatPrice={formatPrice}
                userRole={user.role}
                onCancelItem={(o, i) => setCancelModal({ isOpen: true, order: o, item: i })}
            />

            <CancelOrderModal
                isOpen={cancelModal.isOpen}
                order={cancelModal.order}
                item={cancelModal.item}
                title={cancelModal.item ? "Cancel Item" : "Cancel Order"}
                onClose={() => setCancelModal({ isOpen: false, order: null, item: null })}
                onConfirm={handleCancelAction}
            />
        </div>
    );
};

export default WaiterDashboard;

