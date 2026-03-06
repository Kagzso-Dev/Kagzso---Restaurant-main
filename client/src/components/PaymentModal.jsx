import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Banknote, QrCode, Smartphone, CreditCard,
    CheckCircle, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';
import qrImage from '../assets/QR.png';

/* ── Payment method config ────────────────────────────────────────────── */
const METHODS = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'from-emerald-500 to-green-600', accent: 'emerald' },
    { id: 'qr', label: 'QR Code', icon: QrCode, color: 'from-violet-500 to-purple-600', accent: 'violet' },
    { id: 'upi', label: 'UPI', icon: Smartphone, color: 'from-blue-500 to-indigo-600', accent: 'blue' },
    { id: 'credit_card', label: 'Credit Card', icon: CreditCard, color: 'from-amber-500 to-orange-600', accent: 'amber' },
];

/* ── Success sound (tiny inline base64 beep) ──────────────────────────── */
const playSuccessSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        // Second tone
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1320;
            osc2.type = 'sine';
            gain2.gain.setValueAtTime(0.3, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.6);
        }, 150);
    } catch (_) { /* AudioContext not available */ }
};

/**
 * PaymentModal
 * Props:
 *   order        – the order object
 *   formatPrice  – price formatter fn
 *   onClose      – close modal callback
 *   onSuccess    – payment success callback (receives { order, payment })
 *   api          – axios instance
 */
const PaymentModal = ({ order, formatPrice, onClose, onSuccess, api }) => {
    const [method, setMethod] = useState(null);
    const [step, setStep] = useState('select'); // select | form | processing | success | error
    const [error, setError] = useState('');

    // Cash state
    const [amountReceived, setAmountReceived] = useState('');
    const [change, setChange] = useState(0);

    // Digital payment state
    const [transactionId, setTransactionId] = useState('');
    const [paidAmount, setPaidAmount] = useState('');


    const modalRef = useRef(null);
    const inputRef = useRef(null);

    const total = order?.finalAmount || 0;

    /* ── Initiate payment on mount ────────────────────────────────── */
    useEffect(() => {
        if (!order?._id) return;
        let cancelled = false;

        const initiate = async () => {
            try {
                await api.post(`/api/payments/${order._id}/initiate`);
            } catch (err) {
                if (!cancelled) {
                    const msg = err.response?.data?.message || 'Failed to initiate payment';
                    // If already in payment flow or paid, don't block
                    if (!msg.includes('already')) {
                        setError(msg);
                        setStep('error');
                    }
                }
            }
        };

        initiate();

        return () => {
            cancelled = true;
        };
    }, [order?._id, api]);

    /* ── Cancel payment on close ──────────────────────────────────── */
    const handleClose = useCallback(async () => {
        if (step !== 'success') {
            try {
                await api.post(`/api/payments/${order._id}/cancel`);
            } catch (_) { /* ignore cancel errors */ }
        }
        onClose();
    }, [step, order?._id, api, onClose]);

    /* ── Close on Escape ──────────────────────────────────────────── */
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape' && step !== 'processing') handleClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [handleClose, step]);

    /* ── Close on backdrop click ──────────────────────────────────── */
    const handleBackdrop = (e) => {
        if (e.target === modalRef.current && step !== 'processing') handleClose();
    };

    /* ── Auto-focus input when method changes ─────────────────────── */
    useEffect(() => {
        if (step === 'form') {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [step]);

    /* ── Select method ────────────────────────────────────────────── */
    const selectMethod = (m) => {
        setMethod(m);
        setError('');
        setAmountReceived('');
        setTransactionId('');
        setPaidAmount(String(total));
        setChange(0);
        setStep('form');
    };

    /* ── Build UPI deep-link string ───────────────────────────────── */
    const buildUpiString = () => {
        const pa = import.meta.env.VITE_MERCHANT_UPI || 'merchant@upi';
        return (
            `upi://pay?pa=${encodeURIComponent(pa)}` +
            `&pn=${encodeURIComponent('Kagzso Restaurant')}` +
            `&am=${total.toFixed(2)}` +
            `&tn=${encodeURIComponent(order.orderNumber)}` +
            `&cu=INR`
        );
    };



    /* ── Cash: calculate change ────────────────────────────────────── */
    useEffect(() => {
        if (method?.id === 'cash') {
            const recv = parseFloat(amountReceived) || 0;
            setChange(Math.max(0, Math.round((recv - total) * 100) / 100));
        }
    }, [amountReceived, total, method]);

    /* ── Quick cash buttons ───────────────────────────────────────── */
    const quickCashAmounts = (() => {
        const rounded = Math.ceil(total / 100) * 100;
        const amounts = [total];
        if (rounded > total) amounts.push(rounded);
        if (rounded + 100 > total) amounts.push(rounded + 100);
        amounts.push(rounded + 500);
        return [...new Set(amounts)];
    })();

    /* ── Validate form ────────────────────────────────────────────── */
    const isFormValid = () => {
        if (!method) return false;

        if (method.id === 'cash') {
            const recv = parseFloat(amountReceived) || 0;
            return recv >= total;
        }

        // Digital methods
        if (!transactionId.trim()) return false;
        const paid = parseFloat(paidAmount) || 0;
        return paid === total;
    };

    /* ── Submit payment ───────────────────────────────────────────── */
    const handleSubmit = async () => {
        if (!isFormValid()) return;

        setStep('processing');
        setError('');

        try {
            const payload = {
                paymentMethod: method.id,
                amountReceived: method.id === 'cash'
                    ? parseFloat(amountReceived)
                    : parseFloat(paidAmount),
                transactionId: method.id === 'cash' ? null : transactionId.trim(),
            };

            const res = await api.post(`/api/payments/${order._id}/process`, payload);

            playSuccessSound();
            setChange(res.data.payment?.change || 0);
            setStep('success');

            // Notify parent after animation
            setTimeout(() => {
                onSuccess?.(res.data);
            }, 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Payment failed. Please try again.');
            setStep('form');
        }
    };

    if (!order) return null;

    return (
        <div
            ref={modalRef}
            onClick={handleBackdrop}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
            <div className="
                relative w-full max-w-lg sm:rounded-3xl rounded-2xl bg-[var(--theme-bg-card)] border border-[var(--theme-border)]
                shadow-2xl shadow-black/60 overflow-hidden
                animate-scale-in max-h-[95vh] flex flex-col modal-shell
            ">
                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)] flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--theme-text-main)]">
                            {step === 'success' ? 'Payment Complete' : 'Process Payment'}
                        </h2>
                        <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                            {order.orderNumber} •{' '}
                            {order.orderType === 'dine-in'
                                ? `Table ${order.tableId?.number || '?'}`
                                : `Token ${order.tokenNumber}`}
                        </p>
                    </div>
                    {step !== 'processing' && (
                        <button
                            onClick={handleClose}
                            className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* ── Amount Banner ───────────────────────────────── */}
                {step !== 'success' && (
                    <div className="px-6 py-4 bg-[var(--theme-bg-muted)] border-b border-[var(--theme-border)] flex-shrink-0">
                        <p className="text-[10px] text-[var(--theme-text-muted)] font-bold uppercase tracking-widest mb-1">Amount Due</p>
                        <p className="text-3xl font-black text-orange-400">{formatPrice(total)}</p>
                        <p className="text-xs text-[var(--theme-text-subtle)] mt-1">
                            {order.items?.filter(i => i.status !== 'CANCELLED').length || 0} items •{' '}
                            {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                    </div>
                )}

                {/* ── Body (scrollable) ──────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* ── Error State ─────────────────────────────── */}
                    {step === 'error' && (
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-red-400" />
                            </div>
                            <p className="text-[var(--theme-text-main)] font-bold mb-2">Payment Error</p>
                            <p className="text-sm text-[var(--theme-text-muted)]">{error}</p>
                            <button
                                onClick={handleClose}
                                className="mt-6 px-6 py-2.5 bg-[var(--theme-bg-hover)] text-[var(--theme-text-main)] rounded-xl text-sm font-semibold hover:bg-[var(--theme-border)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* ── Step 1: Method Selection ───────────────── */}
                    {step === 'select' && (
                        <div className="p-5 grid grid-cols-2 gap-3">
                            {METHODS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => selectMethod(m)}
                                    className="
                                        group flex flex-col items-center gap-3 p-5 rounded-2xl
                                        bg-[var(--theme-bg-hover)] border border-[var(--theme-border)]
                                        hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5
                                        transition-all duration-200 tap-scale
                                    "
                                >
                                    <div className={`
                                        w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color}
                                        flex items-center justify-center shadow-lg
                                        group-hover:scale-110 transition-transform
                                    `}>
                                        <m.icon size={26} className="text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-[var(--theme-text-main)]">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Step 2: Payment Form ───────────────────── */}
                    {step === 'form' && method && (
                        <div className="p-5 space-y-4">
                            {/* Method indicator */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    className="text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] underline transition-colors"
                                >
                                    ← Change method
                                </button>
                                <div className={`
                                    ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg
                                    bg-gradient-to-r ${method.color} text-white text-xs font-bold
                                `}>
                                    <method.icon size={14} />
                                    {method.label}
                                </div>
                            </div>

                            {/* ── Cash Form ──────────────────────── */}
                            {method.id === 'cash' && (
                                <div className="space-y-4">
                                    {/* Quick amount buttons */}
                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Quick Select
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {quickCashAmounts.map((amt) => (
                                                <button
                                                    key={amt}
                                                    onClick={() => setAmountReceived(String(amt))}
                                                    className={`
                                                        px-2 py-2.5 rounded-xl text-sm font-bold transition-all border
                                                        ${parseFloat(amountReceived) === amt
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                            : 'bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-emerald-500/30'
                                                        }
                                                    `}
                                                >
                                                    {formatPrice(amt)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Amount input */}
                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Amount Received
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--theme-text-muted)]">₹</span>
                                            <input
                                                ref={inputRef}
                                                type="number"
                                                value={amountReceived}
                                                onChange={e => setAmountReceived(e.target.value)}
                                                placeholder="0.00"
                                                className="
                                                    w-full pl-10 pr-4 py-3.5 text-xl font-bold rounded-xl
                                                    bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                    text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                                    focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                                    transition-all
                                                "
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>

                                    {/* Change display */}
                                    {parseFloat(amountReceived) >= total && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between animate-fade-in">
                                            <span className="text-sm font-bold text-emerald-400">Change to Return</span>
                                            <span className="text-2xl font-black text-emerald-400">{formatPrice(change)}</span>
                                        </div>
                                    )}

                                    {/* Insufficient warning */}
                                    {amountReceived && parseFloat(amountReceived) < total && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                                            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                                            <span className="text-xs text-red-400 font-medium">
                                                Insufficient amount. Need {formatPrice(total - (parseFloat(amountReceived) || 0))} more.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── QR Form ─────────────────────────── */}
                            {method.id === 'qr' && (
                                <div className="space-y-4">
                                    {/* Static QR image */}
                                    <div className="bg-white rounded-2xl p-5 flex flex-col items-center">
                                        <img
                                            src={qrImage}
                                            alt="UPI Payment QR"
                                            className="w-56 h-56 object-contain"
                                        />
                                        <p className="mt-3 text-lg font-black text-gray-900">
                                            Pay {formatPrice(total)}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">Scan with any UPI app</p>
                                    </div>

                                    {/* Transaction ID */}
                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Transaction ID / UTR
                                        </label>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={transactionId}
                                            onChange={e => setTransactionId(e.target.value)}
                                            placeholder="Enter transaction reference"
                                            className="
                                                w-full px-4 py-3 rounded-xl
                                                bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                                focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20
                                                transition-all text-sm
                                            "
                                        />
                                    </div>

                                    {/* Paid amount confirmation */}
                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Paid Amount (confirm)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--theme-text-muted)]">₹</span>
                                            <input
                                                type="number"
                                                value={paidAmount}
                                                onChange={e => setPaidAmount(e.target.value)}
                                                className="
                                                    w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold
                                                    bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                    text-[var(--theme-text-main)]
                                                    focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20
                                                    transition-all
                                                "
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        {paidAmount && parseFloat(paidAmount) !== total && (
                                            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                Amount must equal {formatPrice(total)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── UPI Form ────────────────────────── */}
                            {method.id === 'upi' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                                        <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Collect via UPI</p>
                                        <p className="text-2xl font-black text-blue-400">{formatPrice(total)}</p>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            UPI Transaction ID
                                        </label>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={transactionId}
                                            onChange={e => setTransactionId(e.target.value)}
                                            placeholder="e.g. 412345678901"
                                            className="
                                                w-full px-4 py-3 rounded-xl
                                                bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                                focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                                                transition-all text-sm
                                            "
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Paid Amount (confirm)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--theme-text-muted)]">₹</span>
                                            <input
                                                type="number"
                                                value={paidAmount}
                                                onChange={e => setPaidAmount(e.target.value)}
                                                className="
                                                    w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold
                                                    bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                    text-[var(--theme-text-main)]
                                                    focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                                                    transition-all
                                                "
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        {paidAmount && parseFloat(paidAmount) !== total && (
                                            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                Amount must equal {formatPrice(total)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Credit Card Form ────────────────── */}
                            {method.id === 'credit_card' && (
                                <div className="space-y-4">
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                                        <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">Card Payment</p>
                                        <p className="text-2xl font-black text-amber-400">{formatPrice(total)}</p>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Approval Code / Transaction ID
                                        </label>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={transactionId}
                                            onChange={e => setTransactionId(e.target.value)}
                                            placeholder="Enter approval code from terminal"
                                            className="
                                                w-full px-4 py-3 rounded-xl
                                                bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                                focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
                                                transition-all text-sm
                                            "
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-wider mb-2 block">
                                            Charged Amount (confirm)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--theme-text-muted)]">₹</span>
                                            <input
                                                type="number"
                                                value={paidAmount}
                                                onChange={e => setPaidAmount(e.target.value)}
                                                className="
                                                    w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold
                                                    bg-[var(--theme-input-bg)] border border-[var(--theme-border-solid)]
                                                    text-[var(--theme-text-main)]
                                                    focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
                                                    transition-all
                                                "
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        {paidAmount && parseFloat(paidAmount) !== total && (
                                            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                Amount must equal {formatPrice(total)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Error message ──────────────────── */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
                                    <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                                    <span className="text-xs text-red-400 font-medium">{error}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Processing State ────────────────────────── */}
                    {step === 'processing' && (
                        <div className="p-12 flex flex-col items-center text-center">
                            <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 size={24} className="text-orange-400 animate-spin" />
                                </div>
                            </div>
                            <p className="text-lg font-bold text-[var(--theme-text-main)]">Processing Payment...</p>
                            <p className="text-sm text-[var(--theme-text-muted)] mt-1">Please wait, do not close this window</p>
                        </div>
                    )}

                    {/* ── Success State ───────────────────────────── */}
                    {step === 'success' && (
                        <div className="p-8 flex flex-col items-center text-center animate-scale-in">
                            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30 animate-bounce">
                                <CheckCircle size={40} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-[var(--theme-text-main)] mb-1">Payment Successful!</h3>
                            <p className="text-emerald-400 text-sm font-medium mb-4">
                                {method?.label} • {formatPrice(total)}
                            </p>

                            {method?.id === 'cash' && change > 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 w-full max-w-[250px] mb-4">
                                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">Change to Return</p>
                                    <p className="text-3xl font-black text-emerald-400">{formatPrice(change)}</p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <p className="text-xs text-[var(--theme-text-muted)]">
                                    KOT closed • Order completed • Closing...
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer / Submit Button ──────────────────────── */}
                {step === 'form' && (
                    <div className="px-6 py-4 border-t border-[var(--theme-border)] flex-shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={!isFormValid()}
                            className={`
                                w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl
                                font-bold text-sm transition-all duration-200
                                ${isFormValid()
                                    ? `bg-gradient-to-r ${method?.color} text-white shadow-lg active:scale-[0.98] hover:shadow-xl`
                                    : 'bg-[var(--theme-bg-hover)] text-[var(--theme-text-subtle)] cursor-not-allowed'
                                }
                            `}
                        >
                            Confirm {method?.label} Payment
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;
