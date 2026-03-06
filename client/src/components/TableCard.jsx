import { Users, Clock, Lock, Sparkles, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STATUS_CONFIG — single source of truth for ALL table status styles / labels.
// Import this wherever you need status colors, labels, or icons (Admin + Waiter).
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_CONFIG = {
    available: {
        bg: 'bg-emerald-900/20',
        border: 'border-emerald-500/50',
        hoverBg: 'hover:bg-emerald-900/30',
        text: 'text-emerald-400',
        dot: 'bg-emerald-500',
        color: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        label: 'Available',
        icon: Sparkles,
    },
    reserved: {
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-500/50',
        hoverBg: '',
        text: 'text-yellow-400',
        dot: 'bg-yellow-500',
        color: 'bg-yellow-500',
        ring: 'ring-yellow-500/30',
        label: 'Reserved',
        icon: Lock,
    },
    occupied: {
        bg: 'bg-red-900/20',
        border: 'border-red-500/50',
        hoverBg: '',
        text: 'text-red-400',
        dot: 'bg-red-500',
        color: 'bg-red-500',
        ring: 'ring-red-500/30',
        label: 'Occupied',
        icon: Users,
    },
    billing: {
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/50',
        hoverBg: '',
        text: 'text-orange-400',
        dot: 'bg-orange-500',
        color: 'bg-orange-500',
        ring: 'ring-orange-500/30',
        label: 'Billing',
        icon: AlertTriangle,
    },
    cleaning: {
        bg: 'bg-gray-700/30',
        border: 'border-gray-500/50',
        hoverBg: 'hover:bg-gray-700/50',
        text: 'text-gray-400',
        dot: 'bg-gray-500',
        color: 'bg-gray-500',
        ring: 'ring-gray-500/30',
        label: 'Cleaning',
        icon: Clock,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TableCard — shared visual component for Admin + Waiter table maps.
//
// Props:
//   table      – table object { _id, number, capacity, status }
//   onClick    – called when card is clicked (pass undefined to make non-clickable)
//   clickable  – boolean; adds pointer cursor, hover, and active scale effect
//   actions    – ReactNode rendered in top-right corner on hover (action icons)
//
// Usage (Admin):
//   <TableCard table={t} actions={<><ResetBtn/><DeleteBtn/></>} />
//
// Usage (Waiter):
//   <TableCard table={t} clickable onClick={...} actions={<ReserveBtn/>} />
// ─────────────────────────────────────────────────────────────────────────────
const TableCard = ({ table, onClick, clickable = false, actions }) => {
    const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
    const StatusIcon = config.icon;

    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? onClick : undefined}
            onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            className={[
                'relative bg-[var(--theme-bg-card)] rounded-2xl border overflow-hidden',
                'flex flex-col items-center',
                'p-4 min-h-[140px] sm:min-h-[155px]',
                'transition-all duration-300 group',
                config.border,
                clickable
                    ? `cursor-pointer hover:shadow-xl active:scale-95 ${config.hoverBg || 'hover:opacity-90'}`
                    : 'cursor-default',
            ].join(' ')}
        >
            {/* Top status colour bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />

            {/* Action icons (shown on hover) */}
            {actions && (
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                    {actions}
                </div>
            )}

            {/* Table number */}
            <div className="text-center mt-2 flex-1 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[var(--theme-text-subtle)] uppercase tracking-widest font-bold">
                    Table
                </span>
                <span className={`text-4xl sm:text-5xl font-black leading-none mt-1 ${config.text}`}>
                    {table.number}
                </span>
            </div>

            {/* Footer: capacity + status badge */}
            <div className="w-full border-t border-[var(--theme-border)] pt-2.5 mt-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-[var(--theme-text-subtle)]">
                    <Users size={12} />
                    {table.capacity}
                </span>
                <div className="flex items-center gap-1.5">
                    <StatusIcon size={11} className={config.text} />
                    <span className={`font-bold uppercase text-[10px] ${config.text}`}>
                        {config.label}
                    </span>
                    <span
                        className={`w-2 h-2 rounded-full ${config.color} ${table.status === 'reserved' ? 'animate-pulse' : ''
                            }`}
                    />
                </div>
            </div>
        </div>
    );
};

export default TableCard;
