import { useState, useContext, useMemo } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Trash2, Plus, RotateCcw, X, Table2 } from 'lucide-react';

// ── Shared components — single source of truth ────────────────────────────
import TableCard, { STATUS_CONFIG } from '../../components/TableCard';
import { useTablesData } from '../../hooks/useTablesData';

/* ── Add Table Modal ─────────────────────────────────────────────────────── */
const AddTableModal = ({ defaultNumber, onClose, onSubmit }) => {
    const [form, setForm] = useState({ number: defaultNumber, capacity: 4 });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-[var(--theme-bg-card)] rounded-2xl w-full max-w-sm shadow-2xl border border-[var(--theme-border)] animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border)]">
                    <h3 className="text-lg font-bold text-[var(--theme-text-main)]">Add New Table</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
                    className="p-6 space-y-4"
                >
                    <div>
                        <label className="block text-sm text-[var(--theme-text-muted)] mb-2 font-medium">
                            Table Number
                        </label>
                        <input
                            type="number"
                            value={form.number}
                            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                            required
                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-3 border border-[var(--theme-border)] focus:border-orange-500 text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--theme-text-muted)] mb-2 font-medium">
                            Seating Capacity
                        </label>
                        <input
                            type="number"
                            value={form.capacity}
                            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                            required
                            min="1"
                            max="20"
                            className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl px-4 py-3 border border-[var(--theme-border)] focus:border-orange-500 text-base"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-xl transition-colors font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm transition-colors"
                        >
                            Add Table
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ── Main Component ───────────────────────────────────────────────────────── */
const AdminTables = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const { user } = useContext(AuthContext);

    // ── Single source of truth: same hook + same API as Waiter ──────────────
    const { tables, setTables, loading } = useTablesData();

    // ── Admin-only actions ───────────────────────────────────────────────────

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this table?')) return;
        try {
            await api.delete(`/api/tables/${id}`, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setTables((prev) => prev.filter((t) => t._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting table');
        }
    };

    const handleForceReset = async (id) => {
        if (!window.confirm('Force reset this table to Available?')) return;
        try {
            const res = await api.put(`/api/tables/${id}/force-reset`, {}, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setTables((prev) => prev.map((t) => (t._id === id ? res.data.table : t)));
        } catch (err) {
            alert(err.response?.data?.message || 'Error resetting table');
        }
    };

    const handleAddTable = async (formData) => {
        try {
            const res = await api.post('/api/tables', formData, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setTables((prev) =>
                [...prev, res.data].sort((a, b) => parseInt(a.number) - parseInt(b.number))
            );
            setIsModalOpen(false);
        } catch (err) {
            alert('Error creating table: ' + (err.response?.data?.message || err.message));
        }
    };

    // ── Derived ──────────────────────────────────────────────────────────────

    const statusCounts = useMemo(() => {
        const counts = {};
        Object.keys(STATUS_CONFIG).forEach((s) => {
            counts[s] = tables.filter((t) => t.status === s).length;
        });
        return counts;
    }, [tables]);

    const filteredTables = useMemo(
        () => (statusFilter === 'all' ? tables : tables.filter((t) => t.status === statusFilter)),
        [tables, statusFilter]
    );

    const nextTableNum =
        tables.length > 0 ? Math.max(...tables.map((t) => parseInt(t.number))) + 1 : 1;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5 animate-fade-in">

            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--theme-bg-card)] rounded-2xl p-5 border border-[var(--theme-border)]">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-[var(--theme-text-main)]">Table Management</h1>
                    <p className="text-sm text-[var(--theme-text-muted)] mt-0.5">{tables.length} tables configured</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm transition-colors shadow-glow-orange min-h-[44px]"
                >
                    <Plus size={18} />
                    Add Table
                </button>
            </div>

            {/* ── Status Strip — uses shared STATUS_CONFIG ──────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <button
                        key={key}
                        onClick={() => setStatusFilter((k) => (k === key ? 'all' : key))}
                        className={`
                            flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                            ${statusFilter === key
                                ? `bg-[var(--theme-bg-hover)] ${config.border}`
                                : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] hover:border-gray-500'
                            }
                        `}
                    >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${config.color}`} />
                        <div className="min-w-0">
                            <p className="text-[10px] text-[var(--theme-text-muted)] uppercase font-bold truncate">
                                {config.label}
                            </p>
                            <p className={`text-2xl font-black ${config.text}`}>
                                {statusCounts[key] || 0}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Tables Grid — uses shared TableCard ───────────────────── */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {Array(12).fill(0).map((_, i) => (
                        <div key={i} className="skeleton rounded-2xl min-h-[140px]" />
                    ))}
                </div>
            ) : filteredTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--theme-text-muted)]">
                    <Table2 size={52} className="mb-3 opacity-20" />
                    <p className="font-semibold text-lg">No tables found</p>
                    <p className="text-sm mt-1">
                        {statusFilter !== 'all'
                            ? `No ${statusFilter} tables`
                            : 'Add your first table to get started'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredTables.map((table) => (
                        <TableCard
                            key={table._id}
                            table={table}
                            // Admin-specific action icons (visible on hover)
                            actions={
                                <>
                                    {table.status !== 'available' && (
                                        <button
                                            onClick={() => handleForceReset(table._id)}
                                            title="Force Reset"
                                            className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(table._id)}
                                        title="Delete"
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            }
                        />
                    ))}
                </div>
            )}

            {/* ── Add Table Modal ──────────────────────────────────────── */}
            {isModalOpen && (
                <AddTableModal
                    defaultNumber={nextTableNum}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleAddTable}
                />
            )}
        </div>
    );
};

export default AdminTables;
