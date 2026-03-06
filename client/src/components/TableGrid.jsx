import { useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { CalendarPlus, X } from 'lucide-react';
import TableCard, { STATUS_CONFIG } from './TableCard';
import { useTablesData } from '../hooks/useTablesData';

/**
 * TableGrid — Waiter-facing table grid.
 *
 * Uses the shared `useTablesData` hook (same API endpoint as Admin).
 * Uses the shared `TableCard` component (same STATUS_CONFIG as Admin).
 *
 * Props:
 *   onSelectTable       – called when a clickable table card is tapped
 *   allowedStatuses     – statuses that trigger onSelectTable (default: ['available'])
 *   showCleanAction     – show "Mark Clean" button below cleaning-status cards
 *   onReserve           – (tableId) => void — override for reserve action
 *   onCancelReservation – (tableId) => void — override for cancel-reservation action
 */
const TableGrid = ({
    onSelectTable,
    allowedStatuses = ['available'],
    showCleanAction = false,
    onReserve,
    onCancelReservation,
}) => {
    const { tables, setTables } = useTablesData();
    const { user } = useContext(AuthContext);

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleTableClick = async (table) => {
        // Waiter taps an available table → auto-reserve then open order
        if (table.status === 'available' && user.role === 'waiter') {
            try {
                const res = await api.put(
                    `/api/tables/${table._id}/reserve`,
                    {},
                    { headers: { Authorization: `Bearer ${user.token}` } }
                );
                setTables((prev) => prev.map((t) => (t._id === table._id ? res.data : t)));
                onSelectTable(res.data);
            } catch (error) {
                alert(error.response?.data?.message || 'Failed to reserve table');
            }
            return;
        }
        if (allowedStatuses.includes(table.status)) {
            onSelectTable(table);
        }
    };

    const handleCleanTable = async (e, table) => {
        e.stopPropagation();
        try {
            await api.put(
                `/api/tables/${table._id}/clean`,
                {},
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setTables((prev) =>
                prev.map((t) =>
                    t._id === table._id ? { ...t, status: 'available', lockedBy: null } : t
                )
            );
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to mark table as clean');
        }
    };

    const handleReserveClick = async (e, table) => {
        e.stopPropagation();
        if (onReserve) { onReserve(table._id); return; }
        try {
            const res = await api.put(
                `/api/tables/${table._id}/reserve`,
                {},
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setTables((prev) => prev.map((t) => (t._id === table._id ? res.data : t)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to reserve table');
        }
    };

    const handleCancelReservationClick = async (e, table) => {
        e.stopPropagation();
        if (onCancelReservation) { onCancelReservation(table._id); return; }
        try {
            const res = await api.put(
                `/api/tables/${table._id}/release`,
                {},
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setTables((prev) => prev.map((t) => (t._id === table._id ? res.data : t)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to cancel reservation');
        }
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const isClickable = (table) => {
        if (table.status === 'available') return true;
        if (showCleanAction && table.status === 'cleaning') return true;
        return allowedStatuses.includes(table.status);
    };

    /** Build the action icon(s) for a given table (shown on card hover) */
    const getActions = (table) => {
        // Only show action icons when at least one handler is wired up
        if (onReserve === undefined && onCancelReservation === undefined) return null;
        // Only on available + reserved — never on occupied / billing / cleaning
        if (table.status !== 'available' && table.status !== 'reserved') return null;

        return (
            <>
                {table.status === 'available' && (
                    <span
                        role="button"
                        onClick={(e) => handleReserveClick(e, table)}
                        title="Reserve Table"
                        className="w-7 h-7 flex items-center justify-center
                            bg-emerald-500/20 hover:bg-emerald-500
                            text-emerald-400 hover:text-white
                            rounded-full transition-all duration-200
                            border border-emerald-500/30 shadow-sm cursor-pointer"
                    >
                        <CalendarPlus size={12} />
                    </span>
                )}
                {table.status === 'reserved' && (
                    <span
                        role="button"
                        onClick={(e) => handleCancelReservationClick(e, table)}
                        title="Cancel Reservation"
                        className="w-7 h-7 flex items-center justify-center
                            bg-red-500/20 hover:bg-red-500
                            text-red-400 hover:text-white
                            rounded-full transition-all duration-200
                            border border-red-500/30 shadow-sm cursor-pointer"
                    >
                        <X size={12} />
                    </span>
                )}
            </>
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div>
            {/* Status Legend — powered by the canonical STATUS_CONFIG */}
            <div className="flex flex-wrap gap-4 mb-6">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const count = tables.filter((t) => t.status === key).length;
                    return (
                        <div key={key} className="flex items-center space-x-2 text-xs">
                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                            <span className="text-[var(--theme-text-muted)] font-medium">{cfg.label}</span>
                            <span className={`${cfg.text} font-bold`}>({count})</span>
                        </div>
                    );
                })}
            </div>

            {/* Table Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tables.map((table) => {
                    const clickable = isClickable(table);
                    return (
                        <div key={table._id} className="flex flex-col gap-2">
                            <TableCard
                                table={table}
                                clickable={clickable}
                                onClick={() => clickable && handleTableClick(table)}
                                actions={getActions(table)}
                            />
                            {/* Mark Clean button — below the card for cleaning tables */}
                            {showCleanAction && table.status === 'cleaning' && (
                                <button
                                    onClick={(e) => handleCleanTable(e, table)}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500
                                        text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    ✓ Mark Clean
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TableGrid;
