import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { Search, Menu, X, Loader2, ShoppingBag } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import useDebounce from '../hooks/useDebounce';

/**
 * Responsive TopBar
 * Props:
 *   onMenuClick      – opens sidebar drawer on mobile/tablet
 *   sidebarCollapsed – (unused visually, reserved for breadcrumb logic)
 *
 * Features added:
 *   - Debounced live search (400ms) across orderNumber, customerName, tableNumber
 *   - Results dropdown with keyboard close (Escape)
 *   - Click-outside closes dropdown
 */
const TopBar = ({ onMenuClick, sidebarCollapsed }) => {
    const { user, formatPrice, serverStatus } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    // ── Search state ──────────────────────────────────────────────────────────
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);
    const debouncedQuery = useDebounce(query, 400);

    // ── Fetch search results when debounced query changes ─────────────────────
    const fetchSearch = useCallback(async (q) => {
        if (!q || q.length < 2) {
            setResults([]);
            setShowDropdown(false);
            return;
        }
        setSearching(true);
        try {
            const res = await api.get(`/api/orders/search?q=${encodeURIComponent(q)}`, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            setResults(res.data.orders || []);
            setShowDropdown(true);
        } catch (err) {
            console.error('[TopBar] Search error:', err.message);
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSearch(debouncedQuery);
    }, [debouncedQuery, fetchSearch]);

    // ── Close dropdown on click outside ───────────────────────────────────────
    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleClearSearch = () => {
        setQuery('');
        setResults([]);
        setShowDropdown(false);
    };

    const handleResultClick = (order) => {
        // Navigate admin to order history; others see it inline
        setShowDropdown(false);
        setQuery('');
        navigate(`/${user.role}/orders`);
    };

    // ── Page title / breadcrumb helpers ───────────────────────────────────────
    const getPageTitle = () => {
        const segments = location.pathname.split('/').filter(Boolean);
        if (!segments.length) return 'Dashboard';
        const last = segments[segments.length - 1];
        const titles = {
            admin: 'Dashboard', kitchen: 'Kitchen Display', cashier: 'Cashier POS',
            waiter: 'Waiter Mode', menu: 'Menu Items', tables: 'Table Map',
            categories: 'Categories', orders: 'Order History', settings: 'Settings',
            'new-order': 'New Order',
            'working-process': 'Working Process', 'kitchen-view': 'Kitchen View',
            'dine-in': 'Dine-In Order', 'take-away': 'Take Away Order',
        };
        return titles[last] || (last.charAt(0).toUpperCase() + last.slice(1));
    };

    const getBreadcrumb = () => {
        const segments = location.pathname.split('/').filter(Boolean);
        return segments.map((seg, i) => {
            const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
            return (
                <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[var(--theme-text-subtle)]">/</span>}
                    <span className={i === segments.length - 1 ? 'text-orange-400 font-semibold' : 'text-[var(--theme-text-subtle)]'}>
                        {label}
                    </span>
                </span>
            );
        });
    };

    const isKitchenView = location.pathname.includes('kitchen');

    // Only show search for admin/cashier/waiter — not kitchen
    const showSearch = !isKitchenView && ['admin', 'cashier', 'waiter'].includes(user?.role);

    // ── Status badge colour helper ─────────────────────────────────────────────
    const statusColor = (status) => {
        const map = {
            completed: 'text-emerald-400', pending: 'text-blue-400',
            preparing: 'text-amber-400', accepted: 'text-indigo-400',
            ready: 'text-teal-400', cancelled: 'text-red-400',
        };
        return map[status] || 'text-[var(--theme-text-muted)]';
    };

    return (
        <header
            className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 lg:px-8 h-16 backdrop-blur-md border-b border-[var(--theme-border)] flex-shrink-0"
            style={{ backgroundColor: 'var(--theme-topbar-bg)' }}
        >
            {/* ── Left: Hamburger + Title ──────────────────────────────── */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Hamburger – hidden on desktop */}
                <button
                    onClick={onMenuClick}
                    className="
                        lg:hidden flex-shrink-0
                        p-2 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]
                        hover:bg-[var(--theme-bg-hover)] transition-colors
                        min-h-[44px] min-w-[44px] flex items-center justify-center
                    "
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>

                <div className="min-w-0">
                    <h1 className="text-lg font-bold text-[var(--theme-text-main)] truncate leading-tight">
                        {getPageTitle()}
                    </h1>
                    {/* Breadcrumb – tablet+ only */}
                    <div className="hidden md:flex items-center gap-1 text-xs mt-0.5">
                        {getBreadcrumb()}
                    </div>
                    {/* Welcome text – mobile only */}
                    <p className="md:hidden text-xs text-[var(--theme-text-subtle)] mt-0.5 truncate">
                        {user?.username}
                    </p>
                </div>
            </div>

            {/* ── Right: Search + Notifications + User ─────────────────── */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* ── Search Box (desktop only, hidden on kitchen view) ── */}
                {showSearch && (
                    <div ref={searchRef} className="hidden md:block relative">
                        <div className={`
                            flex items-center bg-[var(--theme-bg-hover)] rounded-xl px-3 py-2
                            border transition-all gap-2
                            ${showDropdown ? 'border-orange-500/50 shadow-lg shadow-orange-500/5' : 'border-[var(--theme-border)] focus-within:border-orange-500/50'}
                        `}>
                            {searching
                                ? <Loader2 size={15} className="text-orange-400 flex-shrink-0 animate-spin" />
                                : <Search size={15} className="text-[var(--theme-text-muted)] flex-shrink-0" />
                            }
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Escape' && handleClearSearch()}
                                placeholder="Order #, Name, Table..."
                                className="
                                    bg-transparent text-sm text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)]
                                    focus:outline-none w-36 md:w-44 lg:w-52
                                    border-none p-0 min-h-0
                                "
                                aria-label="Search orders"
                                id="topbar-search"
                            />
                            {query && (
                                <button
                                    onClick={handleClearSearch}
                                    className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] transition-colors flex-shrink-0"
                                    aria-label="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* ── Results Dropdown ───────────────────── */}
                        {showDropdown && (
                            <div className="
                                absolute top-full right-0 mt-2 w-80
                                bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-2xl
                                shadow-2xl shadow-black/40 overflow-hidden z-50
                                animate-fade-in
                            ">
                                {results.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-[var(--theme-text-muted)] gap-2">
                                        <ShoppingBag size={28} className="opacity-30" />
                                        <p className="text-sm">No orders found for "{query}"</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="px-4 py-2.5 border-b border-[var(--theme-border)] flex items-center justify-between">
                                            <p className="text-xs text-[var(--theme-text-muted)] font-semibold uppercase tracking-wider">
                                                {results.length} result{results.length !== 1 ? 's' : ''}
                                            </p>
                                            <p className="text-[10px] text-[var(--theme-text-subtle)]">Press Esc to close</p>
                                        </div>
                                        <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-[var(--theme-border)]">
                                            {results.map(order => (
                                                <button
                                                    key={order._id}
                                                    onClick={() => handleResultClick(order)}
                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--theme-bg-hover)] transition-colors group"
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-bold text-[var(--theme-text-main)] group-hover:text-orange-400 transition-colors">
                                                            {order.orderNumber}
                                                        </span>
                                                        <span className={`text-[10px] font-bold uppercase ${statusColor(order.orderStatus)}`}>
                                                            {order.orderStatus}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs text-[var(--theme-text-muted)]">
                                                            {order.orderType === 'dine-in'
                                                                ? `Table ${order.tableId?.number ?? '–'}`
                                                                : `Token ${order.tokenNumber}`
                                                            }
                                                            {order.customerInfo?.name && ` • ${order.customerInfo.name}`}
                                                        </p>
                                                        <p className="text-xs font-semibold text-[var(--theme-text-main)]">
                                                            {typeof formatPrice === 'function' ? formatPrice(order.finalAmount) : `₹${order.finalAmount}`}
                                                        </p>
                                                    </div>
                                                    <p className="text-[10px] text-[var(--theme-text-subtle)] mt-0.5">
                                                        {new Date(order.createdAt).toLocaleString()}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="px-4 py-2 border-t border-[var(--theme-border)] bg-[var(--theme-bg-hover)]">
                                            <p className="text-[10px] text-[var(--theme-text-subtle)] text-center">
                                                Showing top {results.length} results — refine your search for more
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Notifications Bell */}
                <NotificationBell />

                {/* User avatar – desktop only */}
                <div className="hidden lg:flex items-center gap-3">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${serverStatus === 'online' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-red-500/5 border-red-500/20 text-red-500 animate-pulse'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {serverStatus === 'online' ? 'Live' : 'Offline'}
                        </span>
                    </div>

                    <div className="h-8 w-px bg-[var(--theme-border)]"></div>

                    <div className="hidden sm:flex flex-col items-end min-w-0">
                        <span className="text-sm font-bold text-[var(--theme-text-main)] truncate max-w-[120px]">{user.name}</span>
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">{user.role}</span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
