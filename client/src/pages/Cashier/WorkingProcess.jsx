import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { Printer, ChefHat } from 'lucide-react';

const WorkingProcess = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const { user, socket, formatPrice, settings } = useContext(AuthContext);

    useEffect(() => {
        const fetchOrders = async () => {
            const res = await api.get('/api/orders', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            // Filter active working process orders
            const ordersArray = res.data.orders || [];
            setOrders(ordersArray.filter(o => ['pending', 'preparing', 'accepted', 'ready'].includes(o.orderStatus)));
        };

        if (user) {
            fetchOrders();
        }

        if (socket) {
            socket.on('new-order', (newOrder) => {
                setOrders(prev => [newOrder, ...prev]);
            });
            socket.on('order-updated', (updatedOrder) => {
                setOrders(prev => {
                    const existing = prev.find(o => o._id === updatedOrder._id);
                    if (['completed', 'cancelled'].includes(updatedOrder.orderStatus)) {
                        if (selectedOrder?._id === updatedOrder._id) setSelectedOrder(null);
                        return prev.filter(o => o._id !== updatedOrder._id);
                    }
                    if (existing) {
                        const updated = prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
                        if (selectedOrder?._id === updatedOrder._id) setSelectedOrder(updatedOrder);
                        return updated;
                    }
                    return [updatedOrder, ...prev];
                });
            });
        }

        return () => {
            if (socket) {
                socket.off('new-order');
                socket.off('order-updated');
            }
        };
    }, [user, socket, selectedOrder]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'text-blue-400 bg-blue-900/30';
            case 'accepted': return 'text-purple-400 bg-purple-900/30';
            case 'preparing': return 'text-orange-400 bg-orange-900/30';
            case 'ready': return 'text-green-400 bg-green-900/30';
            default: return 'text-gray-400 bg-gray-900/30';
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[var(--theme-bg-card)] p-4 sm:p-6 rounded-xl shadow-lg border border-[var(--theme-border)]">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg text-xl flex-shrink-0">
                        <ChefHat size={24} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-[var(--theme-text-main)] tracking-wide leading-none truncate">{settings.restaurantName}</h2>
                        <p className="text-xs text-orange-400 font-bold uppercase tracking-widest mt-1">Working Process Detail</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 flex-shrink-0">
                    <div className="text-right hidden md:block">
                        <p className="text-[var(--theme-text-main)] font-bold">{user.username}</p>
                        <p className="text-xs text-green-400 font-mono">Connected</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[var(--theme-bg-hover)] flex items-center justify-center text-[var(--theme-text-muted)]">
                        {user.username.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 flex-1 overflow-hidden h-auto lg:h-[calc(100vh-260px)] min-h-[500px]">
                {/* Left: Active Orders List */}
                <div className="lg:col-span-1 bg-[var(--theme-bg-card)] rounded-xl shadow-lg border border-[var(--theme-border)] overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg-hover)] flex justify-between items-center">
                        <h2 className="text-lg font-bold text-[var(--theme-text-main)]">Active Orders</h2>
                        <span className="bg-orange-600/20 text-orange-400 text-xs px-2 py-1 rounded-full font-bold">{orders.length}</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
                        {orders.map(order => (
                            <div
                                key={order._id}
                                onClick={() => setSelectedOrder(order)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedOrder?._id === order._id
                                    ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10'
                                    : 'bg-[var(--theme-bg-dark)] border-[var(--theme-border)] hover:bg-[var(--theme-bg-hover)] hover:border-[var(--theme-text-muted)]'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-[var(--theme-text-main)] text-md">{order.orderNumber}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${getStatusColor(order.orderStatus)}`}>
                                        {order.orderStatus}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <p className="text-xs text-[var(--theme-text-muted)]">
                                        {order.orderType === 'dine-in' ? `Table ${order.tableId}` : `Token ${order.tokenNumber}`}
                                    </p>
                                    <p className="text-sm font-semibold text-[var(--theme-text-muted)]">{new Date(order.createdAt).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                        {orders.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                <p>No active kitchen orders</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Order Details */}
                <div className="lg:col-span-2 bg-[var(--theme-bg-card)] rounded-xl shadow-lg border border-[var(--theme-border)] flex flex-col overflow-hidden relative">
                    <style>
                        {`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #printable-kot, #printable-kot * {
                                visibility: visible;
                            }
                            #printable-kot {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                height: 100%;
                                margin: 0;
                                padding: 0;
                                background: white;
                            }
                            @page {
                                size: auto;
                                margin: 0mm;
                            }
                        }
                        `}
                    </style>
                    {selectedOrder ? (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex justify-center bg-[var(--theme-bg-dark)]">
                                <div id="printable-kot" className="w-full max-w-sm bg-white text-black p-6 shadow-2xl relative">
                                    {/* Watermark */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                                        <h1 className="text-9xl font-bold uppercase rotate-45">KOT</h1>
                                    </div>

                                    {/* KOT Header */}
                                    <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4 relative z-10">
                                        <h1 className="text-3xl font-extrabold tracking-tight mb-1">KITCHEN ORDER</h1>
                                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest">{selectedOrder.orderType}</p>
                                    </div>

                                    {/* Meta Data */}
                                    <div className="flex justify-between text-xs mb-4 relative z-10">
                                        <div className="text-left">
                                            <p><span className="font-bold">Order:</span> {selectedOrder.orderNumber}</p>
                                            <p><span className="font-bold">Time:</span> {new Date(selectedOrder.createdAt).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p><span className="font-bold text-lg">{selectedOrder.orderType === 'dine-in' ? `TBL ${selectedOrder.tableId}` : `TOK ${selectedOrder.tokenNumber}`}</span></p>
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <table className="w-full text-sm text-left mb-6 relative z-10">
                                        <thead>
                                            <tr className="border-b border-black">
                                                <th className="py-1">Item</th>
                                                <th className="py-1 text-center">Qty</th>
                                                <th className="py-1 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedOrder.items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-dashed border-gray-200">
                                                    <td className="py-3">
                                                        <span className="font-bold">{item.name}</span>
                                                        {item.notes && <div className="text-xs text-gray-500 italic mt-1">Note: {item.notes}</div>}
                                                    </td>
                                                    <td className="py-3 text-center font-bold text-lg">{item.quantity}</td>
                                                    <td className="py-3 text-right">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${item.status === 'ready' ? 'border-green-600 text-green-600' :
                                                            item.status === 'cancelled' ? 'border-red-600 text-red-600 line-through' :
                                                                'border-gray-400 text-gray-600'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Order Status */}
                                    <div className="border-t-2 border-black pt-4 text-center relative z-10">
                                        <p className="text-xs font-bold uppercase mb-2">Order Status</p>
                                        <div className={`text-xl font-black uppercase tracking-widest py-2 border-2 ${selectedOrder.orderStatus === 'ready' ? 'border-green-600 text-green-600' :
                                            selectedOrder.orderStatus === 'preparing' ? 'border-orange-500 text-orange-500' :
                                                'border-blue-500 text-blue-500'
                                            }`}>
                                            {selectedOrder.orderStatus}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-6 bg-[var(--theme-bg-hover)] border-t border-[var(--theme-border)] flex items-center justify-end gap-4">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center space-x-2 px-6 py-3 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-hover)] text-[var(--theme-text-main)] rounded-xl transition-colors font-semibold border border-[var(--theme-border)]"
                                >
                                    <Printer size={20} />
                                    <span>Print KOT</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full items-center justify-center text-[var(--theme-text-muted)] p-8 space-y-6">
                            <div className="w-24 h-24 bg-[var(--theme-bg-dark)] rounded-full flex items-center justify-center border-4 border-[var(--theme-border)] shadow-2xl">
                                <ChefHat size={48} className="text-orange-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-bold text-[var(--theme-text-main)]">No Order Selected</h3>
                                <p className="max-w-xs mx-auto">Select an order to view its working process details.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkingProcess;

