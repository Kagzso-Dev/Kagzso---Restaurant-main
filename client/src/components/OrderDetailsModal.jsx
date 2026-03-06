import { useEffect } from 'react';
import {
    X, Clock, Utensils, CreditCard, Banknote, QrCode,
    Printer, Wallet, ShoppingBag, CheckCircle2, ChefHat,
} from 'lucide-react';
import { printBill } from './BillPrint';
import StatusBadge from './StatusBadge';
import { tokenColors } from '../utils/tokenColors';

const OrderDetailsModal = ({
    order,
    isOpen,
    onClose,
    formatPrice,
    onProcessPayment,
    onCancelItem,
    userRole,
}) => {
    // Lock background scroll while modal is open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen || !order) return null;

    const isPaid = order.paymentStatus === 'paid';
    const isCompleted = order.orderStatus === 'completed';
    const isCancelled = order.orderStatus === 'cancelled';
    const activeItems = order.items.filter(
        (i) => i.status !== 'CANCELLED' && i.status !== 'Cancelled'
    );

    // ── Helpers ────────────────────────────────────────────────────────────────


    const canCancelItem = (item) => {
        if (!onCancelItem || isCompleted || isCancelled) return false;
        if (item.status === 'CANCELLED' || item.status === 'Cancelled') return false;
        const s = item.status?.toUpperCase();
        if (userRole === 'waiter') return s === 'PENDING';
        if (userRole === 'kitchen') return ['PENDING', 'PREPARING'].includes(s);
        if (userRole === 'admin' || userRole === 'cashier') return true;
        return false;
    };

    const PaymentIcon = ({ method }) => {
        switch (method?.toLowerCase()) {
            case 'cash': return <Banknote size={13} />;
            case 'upi':
            case 'qr': return <QrCode size={13} />;
            case 'credit_card':
            case 'card': return <CreditCard size={13} />;
            default: return <Wallet size={13} />;
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        /* ── Overlay ─────────────────────────────────────────────────────────── */
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* ── Modal shell ─────────────────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col w-full max-w-[1000px] max-h-[90vh] bg-[#111318] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* ─── HEADER ──────────────────────────────────────────────────── */}
                <div className={`
                    flex items-center justify-between px-6 py-5 
                    border-l-8 border-b border-black/5 shrink-0
                    ${tokenColors[order.orderStatus] || 'bg-[#161920] text-white border-gray-800'}
                `}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-xl bg-black/10 border border-black/5 flex items-center justify-center">
                            <ShoppingBag className="text-inherit opacity-80" size={17} />
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap text-inherit">
                                <h2 className="text-base font-black tracking-tight">{order.orderNumber}</h2>

                                {/* Order-status badge */}
                                <StatusBadge status={order.orderStatus} />

                                {/* PAID / UNPAID badge */}
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-widest ${isPaid
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
                                    }`}>
                                    {isPaid ? '✓ PAID' : '⚠ UNPAID'}
                                </span>
                            </div>

                            <p className="text-inherit opacity-60 text-[11px] flex items-center gap-1.5 mt-0.5">
                                <Clock size={11} className="text-inherit opacity-80 shrink-0" />
                                {new Date(order.createdAt).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                })}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 shrink-0 flex items-center justify-center bg-black/10 hover:bg-red-500/20 hover:text-red-600 rounded-xl text-inherit opacity-70 hover:opacity-100 transition-all border border-black/5 ml-4"
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* ─── BODY (2 columns) ────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">

                    {/* LEFT — Order Info + Financial Summary */}
                    <div className="md:w-[37%] shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-[#161920] overflow-y-auto">
                        <div className="p-5 space-y-4">

                            {/* ── Order Info card ───────────────────────────── */}
                            <div className="bg-[#1d2028] rounded-xl border border-white/10 p-4 space-y-3">
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.18em]">
                                    Order Info
                                </p>

                                <InfoRow label={<><Utensils size={13} className="text-orange-500" /> Type</>}>
                                    <span className="text-xs font-black text-white capitalize">{order.orderType}</span>
                                </InfoRow>

                                {order.orderType === 'dine-in' && (
                                    <InfoRow label="Table">
                                        <span className="text-xs font-black text-orange-400">
                                            Table {order.tableId?.number || order.tableId}
                                        </span>
                                    </InfoRow>
                                )}

                                {order.customerInfo?.name && (
                                    <InfoRow label="Customer">
                                        <span className="text-xs font-bold text-white">{order.customerInfo.name}</span>
                                    </InfoRow>
                                )}

                                <div className="h-px bg-gray-600/40" />

                                {/* Payment status */}
                                <InfoRow label={<><CreditCard size={13} className={isPaid ? 'text-emerald-500' : 'text-red-500'} /> Payment</>}>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${isPaid
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-red-500/10    text-red-400    border-red-500/20'
                                        }`}>
                                        {isPaid ? 'Paid' : 'Unpaid'}
                                    </span>
                                </InfoRow>

                                {isPaid && order.paymentMethod && (
                                    <InfoRow label={<><PaymentIcon method={order.paymentMethod} /> Method</>}>
                                        <span className="text-xs font-black text-white uppercase">
                                            {order.paymentMethod.replace('_', ' ')}
                                        </span>
                                    </InfoRow>
                                )}

                                {order.paidAt && (
                                    <InfoRow label="Paid At">
                                        <span className="text-xs text-white">
                                            {new Date(order.paidAt).toLocaleTimeString('en-IN', {
                                                hour: '2-digit', minute: '2-digit', hour12: true,
                                            })}
                                        </span>
                                    </InfoRow>
                                )}
                            </div>

                            {/* ── Bill Summary card ─────────────────────────── */}
                            <div className="bg-[#1d1810] rounded-xl border border-orange-500/30 p-4 space-y-2.5">
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.18em]">
                                    Bill Summary
                                </p>

                                <InfoRow label="Subtotal">
                                    <span className="text-xs font-bold text-white">{formatPrice(order.totalAmount)}</span>
                                </InfoRow>
                                <InfoRow label="GST">
                                    <span className="text-xs font-bold text-white">{formatPrice(order.tax || 0)}</span>
                                </InfoRow>
                                {order.discount > 0 && (
                                    <InfoRow label="Discount">
                                        <span className="text-xs font-bold text-emerald-400">
                                            &minus;{formatPrice(order.discount)}
                                        </span>
                                    </InfoRow>
                                )}

                                <div className="pt-3 border-t border-orange-500/15">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[9px] text-white/70 font-black uppercase tracking-wider">
                                                Grand Total
                                            </p>
                                            <p className="text-2xl font-black text-white tracking-tight leading-none mt-1">
                                                {formatPrice(order.finalAmount)}
                                            </p>
                                        </div>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isPaid
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                            : 'bg-gray-800 border-gray-700 text-gray-600'
                                            }`}>
                                            <CheckCircle2 size={22} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Subtle DB ID */}
                            <p className="text-[10px] text-gray-400 font-mono text-center truncate px-1 select-all">
                                {order._id}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT — Items list */}
                    <div className="flex-1 overflow-y-auto bg-[#111318]">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black text-white uppercase tracking-[0.18em]">
                                    Ordered Items
                                </p>
                                <span className="px-2.5 py-0.5 bg-[#1d2028] rounded-full text-[10px] font-black text-white border border-white/20">
                                    {activeItems.length} active &middot; {order.items.length} total
                                </span>
                            </div>

                            <div className="space-y-2">
                                {order.items.map((item, idx) => {
                                    const cancelled = item.status === 'CANCELLED' || item.status === 'Cancelled';
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between rounded-xl px-4 py-3 border backdrop-blur-sm transition-all ${cancelled
                                                ? 'opacity-40 bg-[#1d2028] border-white/10'
                                                : 'bg-[#1d2028] border-white/10 hover:bg-[#252830] hover:border-orange-500/30'
                                                }`}
                                        >
                                            {/* Left: qty badge + name + status */}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black ${cancelled
                                                    ? 'bg-gray-800 text-gray-500'
                                                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                    }`}>
                                                    {item.quantity}&times;
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-bold truncate ${cancelled ? 'line-through text-gray-500' : 'text-white'}`}>
                                                        {item.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <StatusBadge status={isCompleted ? 'Completed' : (item.status || 'Pending')} />
                                                        <span className="text-[10px] text-white">
                                                            {formatPrice(item.price)} each
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: line total + cancel */}
                                            <div className="flex items-center gap-3 shrink-0 ml-4">
                                                <p className={`text-sm font-black ${cancelled ? 'text-gray-600 line-through' : 'text-white'}`}>
                                                    {formatPrice(item.price * item.quantity)}
                                                </p>
                                                {canCancelItem(item) && (
                                                    <button
                                                        onClick={() => onCancelItem(order, item)}
                                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/10"
                                                        title="Cancel item"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Kitchen status note */}
                            <div className="mt-4 flex items-center gap-2 text-white bg-[#1d2028] px-4 py-3 rounded-xl border border-white/10">
                                <ChefHat size={14} className="shrink-0" />
                                <p className="text-[10px] font-medium leading-snug">
                                    {isCompleted
                                        ? `Served at ${new Date(order.completedAt || order.updatedAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`
                                        : `${activeItems.length} active item${activeItems.length !== 1 ? 's' : ''} in kitchen queue`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── FOOTER / ACTIONS ────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-5 bg-[#161920] border-t border-white/10 shrink-0">
                    <p className="hidden sm:block text-[10px] text-white/70 font-mono truncate max-w-[200px] select-all">
                        ID: {order._id}
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest border border-white/10 active:scale-95"
                        >
                            Close
                        </button>

                        {/* Process Payment — only when unpaid & not cancelled */}
                        {!isPaid && !isCancelled && onProcessPayment && (
                            <button
                                onClick={() => onProcessPayment(order)}
                                className="flex-1 sm:flex-none px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95"
                            >
                                <Wallet size={15} /> Process Payment
                            </button>
                        )}

                        {/* Print Bill — disabled until paid */}
                        {!isCancelled && (
                            <button
                                disabled={!isPaid}
                                onClick={() => isPaid && printBill(order, formatPrice)}
                                title={isPaid ? 'Print thermal bill' : 'Payment required before printing'}
                                className={`flex-1 sm:flex-none px-5 py-2.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest ${isPaid
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
                                    : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                                    }`}
                            >
                                <Printer size={15} />
                                Print Bill
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

/* ── Layout helper: keeps JSX above clean ───────────────────────────────────── */
const InfoRow = ({ label, children }) => (
    <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-white text-xs font-semibold shrink-0">
            {label}
        </div>
        <div className="text-right">{children}</div>
    </div>
);

export default OrderDetailsModal;
