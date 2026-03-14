import { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { Plus, Search, SearchX, Utensils } from 'lucide-react';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';


const AdminMenu = () => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState(null);
    const [formError, setFormError] = useState('');
    const { user, formatPrice, socket } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        name: '', description: '', price: '', category: '', image: '', isVeg: true, availability: true,
    });
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('adminMenuViewMode') || 'grid');

    useEffect(() => {
        localStorage.setItem('adminMenuViewMode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        fetchData();
    }, []);

    // ── Real-time socket subscriptions ─────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onMenuUpdated = ({ action, item, id }) => {
            if (action === 'create' && item) {
                // Deduplicate: socket may fire after the API response already added the item
                setItems(prev => prev.find(i => i._id === item._id) ? prev.map(i => i._id === item._id ? item : i) : [...prev, item]);
            } else if (action === 'update' && item) {
                setItems(prev => prev.map(i => i._id === item._id ? item : i));
            } else if (action === 'delete' && id) {
                setItems(prev => prev.filter(i => String(i._id) !== String(id)));
            }
        };

        const onCategoryUpdated = ({ action, category, id }) => {
            if (action === 'create' && category) {
                setCategories(prev => prev.find(c => c._id === category._id) ? prev : [...prev, category]);
            } else if (action === 'update' && category) {
                setCategories(prev => prev.map(c => c._id === category._id ? category : c));
            } else if (action === 'delete' && id) {
                setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
                if (filterCategory === id) setFilterCategory(null);
            }
        };

        socket.on('menu-updated', onMenuUpdated);
        socket.on('category-updated', onCategoryUpdated);
        return () => {
            socket.off('menu-updated', onMenuUpdated);
            socket.off('category-updated', onCategoryUpdated);
        };
    }, [socket, filterCategory]);

    const fetchData = async () => {
        try {
            const [menuRes, catRes] = await Promise.all([
                api.get('/api/menu'),
                api.get('/api/categories'),
            ]);
            setItems(menuRes.data);
            setCategories(catRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this item?')) return;
        try {
            await api.delete(`/api/menu/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
            // Socket event will remove from state; also remove optimistically in case socket is slow
            setItems(prev => prev.filter(i => String(i._id) !== String(id)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete item');
        }
    };

    // Quick toggle availability without opening modal
    const handleToggleAvailability = async (item) => {
        try {
            await api.put(`/api/menu/${item._id}`, { availability: !item.availability }, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            // Socket event 'menu-updated' will update the state
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update availability');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            if (editingItem) {
                const res = await api.put(`/api/menu/${editingItem._id}`, formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setItems(prev => prev.map(i => i._id === editingItem._id ? res.data : i));
            } else {
                const res = await api.post('/api/menu', formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                // Deduplicate in case socket fires first
                setItems(prev => prev.find(i => i._id === res.data._id) ? prev : [...prev, res.data]);
            }
            closeModal();
        } catch (error) {
            setFormError(error.response?.data?.message || 'Failed to save item');
        }
    };

    const openModal = (item = null) => {
        setFormError('');
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                description: item.description || '',
                price: item.price,
                category: item.category?._id || item.category,
                image: item.image || '',
                isVeg: item.isVeg,
                availability: item.availability,
            });
        } else {
            setEditingItem(null);
            setFormData({
                name: '', description: '', price: '',
                category: categories.find(c => c.status === 'active')?._id || categories[0]?._id || '',
                image: '', isVeg: true, availability: true,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormError('');
    };

    // ── Filtered items ─────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchCat = filterCategory ? String(item.category?._id) === String(filterCategory) : true;
            const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCat && matchSearch;
        });
    }, [items, filterCategory, searchQuery]);

    const activeCategories = categories.filter(c => c.status === 'active');

    return (
        <div className="space-y-6">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--theme-bg-card2)] p-6 rounded-xl shadow-lg border border-[var(--theme-border)] gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--theme-text-main)]">Menu Management</h2>
                    <p className="text-sm text-[var(--theme-text-muted)] mt-1">
                        {items.length} items · {items.filter(i => i.availability).length} available
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <button
                        onClick={() => openModal()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[40px]"
                    >
                        <Plus size={18} />
                        <span>Add Item</span>
                    </button>
                </div>
            </div>

            {/* ── Search + Category Filter ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" size={16} />
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--theme-bg-card)] text-[var(--theme-text-main)] rounded-xl pl-9 pr-9 py-2.5 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none text-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <SearchX size={14} />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterCategory(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${filterCategory === null ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-blue-500'}`}
                    >
                        All
                    </button>
                    {activeCategories.map(cat => (
                        <button
                            key={cat._id}
                            onClick={() => setFilterCategory(cat._id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${String(filterCategory) === String(cat._id) ? 'text-white border-transparent' : 'bg-[var(--theme-bg-card)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:border-blue-500'}`}
                            style={String(filterCategory) === String(cat._id) ? { backgroundColor: cat.color || '#3b82f6' } : {}}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Items Grid / List ────────────────────────────────────── */}
            {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--theme-text-muted)]">
                    <Utensils size={48} className="mb-3 opacity-20" />
                    <p className="font-bold text-lg">No items found</p>
                    <p className="text-sm">Try a different search or category filter</p>
                </div>
            ) : (
                <div className={viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                    : 'flex flex-col gap-4'
                }>
                    {filteredItems.map(item => (
                        <div key={item._id} className={!item.availability ? 'opacity-50' : ''}>
                            <FoodItem
                                item={item}
                                viewMode={viewMode}
                                formatPrice={formatPrice}
                                onEdit={openModal}
                                onDelete={handleDelete}
                                onToggleAvailability={handleToggleAvailability}
                                isAdmin={true}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modal ────────────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--theme-bg-card)] p-5 sm:p-8 rounded-xl w-full max-w-lg shadow-2xl border border-[var(--theme-border)] animate-fade-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-[var(--theme-text-main)] mb-6">
                            {editingItem ? 'Edit Item' : 'Add New Item'}
                        </h3>

                        {formError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none"
                                    rows="2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Price *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        required
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Category *</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        required
                                        className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">-- Select category --</option>
                                        {categories.map(c => (
                                            <option key={c._id} value={c._id}>
                                                {c.name}{c.status === 'inactive' ? ' (inactive)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Image URL</label>
                                <input
                                    type="text"
                                    value={formData.image}
                                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Toggles row */}
                            <div className="flex flex-wrap gap-4 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div
                                        onClick={() => setFormData(f => ({ ...f, isVeg: !f.isVeg }))}
                                        className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${formData.isVeg ? 'bg-emerald-500' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isVeg ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-sm text-[var(--theme-text-main)]">Vegetarian</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div
                                        onClick={() => setFormData(f => ({ ...f, availability: !f.availability }))}
                                        className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${formData.availability ? 'bg-blue-500' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.availability ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-sm text-[var(--theme-text-main)]">
                                        {formData.availability ? 'Available on menu' : 'Hidden from menu'}
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold">
                                    {editingItem ? 'Update Item' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminMenu;

