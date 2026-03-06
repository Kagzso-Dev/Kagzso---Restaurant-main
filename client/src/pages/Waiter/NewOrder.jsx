import { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import {
    Search, ShoppingCart, ArrowLeft, ArrowRight,
    Utensils, Package, ChevronLeft, ChevronRight,
    SearchX, Trash2, Plus, Minus
} from 'lucide-react';
import TableGrid from '../../components/TableGrid';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';


/**
 * SaaS POS / New Order Screen
 * Optimized for Desktop (3-panel) and Mobile (stacked tabs)
 */
const NewOrder = () => {
    // ── State ────────────────────────────────────────────────────────
    const [step, setStep] = useState(1); // 1: Type, 2: Table, 3: Menu
    const [orderType, setOrderType] = useState(null); // 'dine-in', 'takeaway'
    const [selectedTable, setSelectedTable] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart overlay toggle
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('foodViewMode') || 'grid');

    useEffect(() => {
        localStorage.setItem('foodViewMode', viewMode);
    }, [viewMode]);


    const { user, formatPrice, settings } = useContext(AuthContext);
    const navigate = useNavigate();

    // ── Data Fetch ───────────────────────────────────────────────────
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [menuRes, catRes] = await Promise.all([
                    api.get('/api/menu'),
                    api.get('/api/categories')
                ]);
                setMenuItems(menuRes.data);
                setCategories(catRes.data);
            } catch (error) {
                console.error("Error fetching POS data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // ── Cart Logic ───────────────────────────────────────────────────
    const addToCart = useCallback((item) => {
        setCart(prev => {
            const existing = prev.find(i => i._id === item._id);
            if (existing) {
                return prev.map(i => i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1, notes: '' }];
        });
    }, []);

    const updateQuantity = useCallback((itemId, delta) => {
        setCart(prev => {
            const existing = prev.find(i => i._id === itemId);
            if (!existing) return prev;
            const newQty = existing.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i._id !== itemId);
            return prev.map(i => i._id === itemId ? { ...i, quantity: newQty } : i);
        });
    }, []);

    const clearCart = () => {
        if (window.confirm("Clear all items?")) setCart([]);
    };

    // ── Filtering ────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            (selectedCategory ? item.category?._id === selectedCategory : true) &&
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [menuItems, selectedCategory, searchQuery]);

    // ── Financial Calculations ───────────────────────────────────────
    const totalAmount = useMemo(() => cart.reduce((sum, i) => sum + (i.price * i.quantity), 0), [cart]);
    const taxRate = settings?.taxRate || 5;
    const tax = totalAmount * (taxRate / 100);
    const finalAmount = totalAmount + tax;

    // ── Submit Logic ─────────────────────────────────────────────────
    const handleSubmitOrder = async () => {
        if (!cart.length) return alert("Cart is empty!");
        if (orderType === 'dine-in' && !selectedTable) return alert("Select a table!");

        const orderData = {
            orderType,
            tableId: selectedTable ? selectedTable._id : null,
            items: cart.map(i => ({
                menuItemId: i._id,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                notes: i.notes
            })),
            totalAmount,
            tax,
            finalAmount
        };

        try {
            await api.post('/api/orders', orderData, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            navigate(user.role === 'waiter' ? '/waiter' : '/admin');
        } catch (error) {
            alert("Order failed: " + (error.response?.data?.message || "Server Error"));
        }
    };

    // ── Render Helpers ───────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="skeleton w-12 h-12 rounded-full" />
        </div>
    );

    return (
        <div className="h-full flex flex-col relative overflow-hidden">

            {/* ── STEP 1: SELECT ORDER TYPE ────────────────────────────── */}
            {step === 1 && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 animate-fade-in">
                    <h2 className="text-2xl md:text-4xl font-black text-[var(--theme-text-main)] text-center">Start New Order</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                        <button
                            onClick={() => { setOrderType('dine-in'); setStep(2); }}
                            className="group relative bg-[var(--theme-bg-card)] p-8 md:p-12 sm:rounded-3xl rounded-2xl border border-[var(--theme-border)] hover:border-orange-500/50 transition-all shadow-xl flex flex-col items-center text-center space-y-4 tap-scale"
                        >
                            <div className="w-20 h-20 bg-orange-500/10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <Utensils size={40} className="text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-[var(--theme-text-main)] uppercase tracking-wide">Dine-In</h3>
                                <p className="text-[var(--theme-text-muted)] text-sm mt-1">Select a table and serve guests</p>
                            </div>
                            <span className="absolute top-4 right-4"><ArrowRight size={20} className="text-gray-600 group-hover:text-orange-500" /></span>
                        </button>

                        <button
                            onClick={() => { setOrderType('takeaway'); setStep(3); }}
                            className="group relative bg-[var(--theme-bg-card)] p-8 md:p-12 sm:rounded-3xl rounded-2xl border border-[var(--theme-border)] hover:border-blue-500/50 transition-all shadow-xl flex flex-col items-center text-center space-y-4 tap-scale"
                        >
                            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <Package size={40} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-[var(--theme-text-main)] uppercase tracking-wide">Takeaway</h3>
                                <p className="text-[var(--theme-text-muted)] text-sm mt-1">Direct tokens for self-pickup</p>
                            </div>
                            <span className="absolute top-4 right-4"><ArrowRight size={20} className="text-gray-600 group-hover:text-blue-500" /></span>
                        </button>
                    </div>
                    <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white font-medium flex items-center gap-2 transition-colors">
                        <ChevronLeft size={18} /> Cancel and go back
                    </button>
                </div>
            )}

            {/* ── STEP 2: TABLE SELECTION (Dine-in Only) ────────────────── */}
            {step === 2 && (
                <div className="flex-1 flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-[var(--theme-text-main)]">Select a Table</h2>
                            <p className="text-[var(--theme-text-muted)] text-sm">Tap an available table to start ordering</p>
                        </div>
                        <button onClick={() => setStep(1)} className="p-3 bg-[var(--theme-bg-hover)] hover:bg-[var(--theme-border)] text-[var(--theme-text-muted)] rounded-xl transition-all">
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                    <div className="flex-1 bg-[var(--theme-bg-card)] rounded-3xl p-6 border border-[var(--theme-border)] shadow-2xl overflow-y-auto custom-scrollbar">
                        <TableGrid
                            allowedStatuses={['available']}
                            onSelectTable={(table) => { setSelectedTable(table); setStep(3); }}
                        />
                    </div>
                </div>
            )}

            {/* ── STEP 3: MAIN POS MENU (Categories | Menu | Cart) ─────── */}
            {step === 3 && (
                <div className="flex flex-col lg:flex-row h-full gap-5 animate-fade-in overflow-hidden">

                    {/* Panel 1 & 2: Categories + Menu Grid */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[var(--theme-bg-card)] rounded-3xl border border-[var(--theme-border)] shadow-2xl overflow-hidden">

                        {/* ── Top Bar (Search + Info) ────── */}
                        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setStep(selectedTable ? 2 : 1)} className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] bg-[var(--theme-bg-hover)] rounded-lg">
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <h2 className="text-lg font-bold text-[var(--theme-text-main)] flex items-center gap-2 truncate">
                                        {selectedTable ? `Table ${selectedTable.number}` : 'Takeaway Order'}
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] font-normal">Step 3 of 3</span>
                                    </h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-1 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-xl pl-10 pr-4 py-2 border-none focus:ring-2 focus:ring-orange-500 text-sm"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                            <SearchX size={14} />
                                        </button>
                                    )}
                                </div>
                                <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* ── Left Rail: Categories ── */}
                            <div className="w-20 md:w-32 flex-shrink-0 border-r border-[var(--theme-border)] flex flex-col overflow-y-auto custom-scrollbar bg-black/5">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`
                                        flex flex-col items-center justify-center py-4 px-2 gap-2 transition-all border-l-4
                                        ${selectedCategory === null ? 'bg-orange-500/10 text-orange-400 border-orange-500' : 'text-gray-500 hover:text-gray-300 border-transparent'}
                                    `}
                                >
                                    <Utensils size={20} />
                                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-tight text-center">All</span>
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat._id}
                                        onClick={() => setSelectedCategory(cat._id)}
                                        className={`
                                            flex flex-col items-center justify-center py-5 px-2 gap-2 transition-all border-l-4 
                                            ${selectedCategory === cat._id ? 'bg-orange-500/10 text-orange-400 border-orange-500' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border-transparent'}
                                        `}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-[var(--theme-bg-hover)] flex items-center justify-center text-xs font-bold">
                                            {cat.name.charAt(0)}
                                        </div>
                                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-tight text-center leading-tight">{cat.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* ── Right Rail: Items Grid ── */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                                {filteredItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                                        <SearchX size={48} className="mb-4 opacity-10" />
                                        <p className="font-medium text-lg">No items found</p>
                                        <p className="text-sm">Try a different category or search term</p>
                                    </div>
                                ) : (
                                    <div className={`
                                        ${viewMode === 'grid'
                                            ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-4'
                                            : 'flex flex-col gap-3'
                                        }
                                    `}>
                                        {filteredItems.map(item => (
                                            <FoodItem
                                                key={item._id}
                                                item={item}
                                                viewMode={viewMode}
                                                formatPrice={formatPrice}
                                                onAdd={addToCart}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Panel 3: Cart / Sidebar Summary ────────────────── */}
                    {/* On Desktop: visible as 3rd panel. On Mobile: visible via isCartOpen toggle */}
                    <aside className={`
                        fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-0 lg:w-[380px] flex-shrink-0
                        transition-transform duration-300 ease-in-out
                        ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                    `}>
                        {/* mobile backdrop */}
                        {isCartOpen && <div onClick={() => setIsCartOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm lg:hidden" />}

                        <div className="relative h-full w-full max-w-[400px] ml-auto lg:ml-0 bg-[var(--theme-bg-card)] rounded-none lg:rounded-3xl border-l lg:border border-[var(--theme-border)] shadow-2xl flex flex-col overflow-hidden">
                            {/* Cart Header */}
                            <div className="px-5 py-5 border-b border-[var(--theme-border)] flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h2 className="text-lg font-black text-[var(--theme-text-main)] flex items-center gap-2">
                                        <ShoppingCart size={18} className="text-orange-500" /> Current Cart
                                    </h2>
                                    <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold mt-0.5">{orderType} • {cart.length} items</p>
                                </div>
                                <button onClick={clearCart} className="p-2 text-[var(--theme-text-muted)] hover:text-rose-400 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Cart Items Area */}
                            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-700 py-10">
                                        <ShoppingCart size={64} className="mb-4 opacity-5" strokeWidth={1} />
                                        <p className="font-bold">Your cart is empty</p>
                                        <p className="text-xs">Add items from the menu to build your order</p>
                                    </div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item._id} className="flex gap-3 animate-slide-up group">
                                            <div className="w-12 h-12 rounded-xl bg-[var(--theme-bg-dark)] flex-shrink-0 overflow-hidden">
                                                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🥘</div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="text-sm font-bold text-[var(--theme-text-main)] truncate pr-2">{item.name}</h4>
                                                    <span className="text-sm font-black text-[var(--theme-text-main)]">{formatPrice(item.price * item.quantity)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center bg-[var(--theme-bg-dark)] rounded-lg p-0.5 border border-[var(--theme-border)]">
                                                        <button onClick={() => updateQuantity(item._id, -1)} className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]"><Minus size={12} /></button>
                                                        <span className="w-8 text-center text-xs font-black text-[var(--theme-text-main)]">{item.quantity}</span>
                                                        <button onClick={() => updateQuantity(item._id, 1)} className="w-7 h-7 flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]"><Plus size={12} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Summary & Place Order */}
                            <div className="p-5 bg-[var(--theme-bg-dark)] border-t border-[var(--theme-border)] flex-shrink-0 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-[var(--theme-text-muted)]">
                                        <span>Subtotal</span>
                                        <span>{formatPrice(totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-[var(--theme-text-muted)]">
                                        <span>Tax ({taxRate}%)</span>
                                        <span>{formatPrice(tax)}</span>
                                    </div>
                                    <div className="flex justify-between items-end pt-2">
                                        <span className="text-sm font-bold text-[var(--theme-text-main)] uppercase tracking-wider">Estimated Total</span>
                                        <span className="text-2xl font-black text-orange-500">{formatPrice(finalAmount)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSubmitOrder}
                                    disabled={cart.length === 0}
                                    className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black rounded-2xl shadow-glow-orange transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Confirm & Place Order <ArrowRight size={18} />
                                </button>
                                <button className="lg:hidden w-full py-3 text-gray-400 font-bold text-xs uppercase tracking-widest" onClick={() => setIsCartOpen(false)}>
                                    Continue Adding Items
                                </button>
                            </div>
                        </div>
                    </aside>
                </div >
            )}

            {/* ── Mobile Cart Trigger (Sticky Bottom) ──────────────────── */}
            {
                step === 3 && cart.length > 0 && !isCartOpen && (
                    <div className="lg:hidden fixed bottom-20 left-4 right-4 z-40 bg-orange-600 rounded-2xl shadow-2xl p-4 flex items-center justify-between animate-slide-up">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <ShoppingCart size={24} className="text-white" />
                                <span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-orange-600 rounded-full flex items-center justify-center text-xs font-black">{cart.length}</span>
                            </div>
                            <div className="text-white">
                                <p className="text-[10px] font-bold uppercase tracking-widest leading-none">Checkout</p>
                                <p className="text-lg font-black leading-tight">{formatPrice(finalAmount)}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsCartOpen(true)}
                            className="bg-white text-orange-600 px-5 py-2.5 rounded-xl font-black text-sm active:scale-95 flex items-center gap-2"
                        >
                            View Order <ChevronRight size={18} />
                        </button>
                    </div>
                )
            }
        </div >
    );
};

export default NewOrder;

