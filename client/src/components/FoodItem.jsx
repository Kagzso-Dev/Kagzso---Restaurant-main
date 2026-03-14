import { memo } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

const FoodItem = memo(({
    item,
    viewMode,
    formatPrice,
    onAdd,
    onEdit,
    onDelete,
    onToggleAvailability,
    showActions = true,
    isAdmin = false
}) => {
    const isVeg = item.isVeg;

    if (viewMode === 'list') {
        return (
            <div
                onClick={() => { if (!isAdmin && showActions) onAdd(item); }}
                className="group bg-[var(--theme-bg-card)] rounded-2xl overflow-hidden border border-[var(--theme-border)] hover:border-orange-500/50 transition-all p-3 flex items-center gap-4 animate-fade-in shadow-md cursor-pointer"
            >
                {/* Image Section */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[var(--theme-bg-dark)] flex-shrink-0">
                    {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl">🍔</div>
                    }
                    <div className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--theme-bg-card)] ring-1 ring-white/10 ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>

                {/* Info Section */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-[var(--theme-text-main)] truncate leading-tight">{item.name}</h3>
                            <p
                                className="text-[9px] font-bold uppercase tracking-widest mt-0.5 px-1.5 py-0.5 rounded-full inline-block border"
                                style={{
                                    backgroundColor: `${item.category?.color || '#3b82f6'}15`,
                                    color: item.category?.color || '#3b82f6',
                                    borderColor: `${item.category?.color || '#3b82f6'}30`
                                }}
                            >
                                {item.category?.name || 'Uncategorized'}
                            </p>
                        </div>
                        <div className="flex flex-col items-start sm:items-end">
                            <span className="text-orange-400 font-black text-sm sm:text-base">{formatPrice(item.price)}</span>
                            {item.description && (
                                <p className="text-[10px] text-[var(--theme-text-subtle)] truncate max-w-[150px] hidden sm:block">
                                    {item.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Section */}
                {showActions && (
                    <div className="flex items-center gap-2">
                        {isAdmin ? (
                            <>
                                {onToggleAvailability && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleAvailability(item); }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${item.availability
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                                            }`}
                                    >
                                        {item.availability ? 'Available' : 'Unavailable'}
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                    className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors"
                                    title="Edit Item"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(item._id); }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Delete Item"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                                className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-lg group-hover:shadow-orange-500/20"
                                title="Add to Cart"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Grid View (Default)
    return (
        <div
            onClick={() => { if (!isAdmin && showActions) onAdd(item); }}
            className="group relative bg-[var(--theme-bg-card)] rounded-2xl overflow-hidden border border-[var(--theme-border)] hover:border-orange-500/50 transition-all p-3 text-left active:scale-[0.98] flex flex-col h-full shadow-md animate-fade-in cursor-pointer"
        >
            <div className="relative h-24 sm:h-32 rounded-xl mb-3 overflow-hidden bg-[var(--theme-bg-dark)]">
                {item.image
                    ? <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">🍔</div>
                }
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-[var(--theme-bg-card)] ring-1 ring-white/10 ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>

            <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-[var(--theme-text-main)] line-clamp-2 leading-tight flex-1 mb-1">{item.name}</h3>
                <p
                    className="text-[9px] font-bold uppercase tracking-widest mb-2 px-1.5 py-0.5 rounded-full inline-block border self-start"
                    style={{
                        backgroundColor: `${item.category?.color || '#3b82f6'}15`,
                        color: item.category?.color || '#3b82f6',
                        borderColor: `${item.category?.color || '#3b82f6'}30`
                    }}
                >
                    {item.category?.name || 'Uncategorized'}
                </p>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--theme-border)]">
                    <span className="text-orange-400 font-black text-sm">{formatPrice(item.price)}</span>

                    {showActions && (
                        <div className="flex items-center gap-1">
                            {isAdmin ? (
                                <>
                                    {onToggleAvailability && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleAvailability(item); }}
                                            className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors ${item.availability
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                                                }`}
                                        >
                                            {item.availability ? 'Live' : 'Hidden'}
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                        className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(item._id); }}
                                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                                    className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors active:scale-95"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default FoodItem;

