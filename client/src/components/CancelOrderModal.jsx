import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const CancelOrderModal = ({ order, item, isOpen, onClose, onConfirm, title = "Cancel Order" }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        if (item) {
            await onConfirm(order._id, item._id, reason);
        } else {
            await onConfirm(order._id, reason);
        }
        setLoading(false);
        setReason('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[var(--theme-overlay)] backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="h-2 bg-red-600" />

                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-[var(--theme-text-main)]">{title}</h3>
                                <p className="text-sm text-[var(--theme-text-subtle)]">
                                    {item ? item.name : order?.orderNumber}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--theme-bg-hover)] rounded-xl text-[var(--theme-text-muted)] transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2 text-center py-2 px-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                            <p className="text-sm text-[var(--theme-text-muted)]">
                                Are you sure you want to cancel this order? This action cannot be undone.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--theme-text-subtle)] uppercase tracking-widest ml-1">
                                Cancellation Reason
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="E.g., Customer changed mind, Out of stock..."
                                className="w-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] rounded-2xl p-4 text-[var(--theme-text-main)] placeholder:text-[var(--theme-text-subtle)] focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[100px] resize-none transition-all"
                                required
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3.5 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-main)] font-bold rounded-2xl transition-all active:scale-95"
                            >
                                Nevermind
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[1.5] py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-glow-red transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {loading ? 'Cancelling...' : 'Confirm Cancellation'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CancelOrderModal;

