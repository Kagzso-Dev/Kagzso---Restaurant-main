import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Trash2, Plus, Edit2 } from 'lucide-react';

const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: '#3b82f6', status: 'active' });
    const [formError, setFormError] = useState('');
    const { user, socket } = useContext(AuthContext);

    const presetColors = [
        { name: 'Blue', hex: '#3b82f6' },
        { name: 'Red', hex: '#ef4444' },
        { name: 'Green', hex: '#10b981' },
        { name: 'Orange', hex: '#f97316' },
        { name: 'Purple', hex: '#8b5cf6' },
        { name: 'Teal', hex: '#14b8a6' },
        { name: 'Pink', hex: '#ec4899' },
    ];

    useEffect(() => {
        fetchCategories();
    }, []);

    // ── Real-time socket subscription ──────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onCategoryUpdated = ({ action, category, id }) => {
            if (action === 'create' && category) {
                setCategories(prev => prev.find(c => c._id === category._id) ? prev.map(c => c._id === category._id ? category : c) : [...prev, category]);
            } else if (action === 'update' && category) {
                setCategories(prev => prev.map(c => c._id === category._id ? category : c));
            } else if (action === 'delete' && id) {
                setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
            }
        };

        socket.on('category-updated', onCategoryUpdated);
        return () => socket.off('category-updated', onCategoryUpdated);
    }, [socket]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/api/categories');
            setCategories(res.data);
        } catch (error) {
            console.error("Error fetching categories", error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category? This will fail if any menu items are assigned to it.')) return;
        try {
            await api.delete(`/api/categories/${id}`, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            // Socket event will update state; also remove optimistically
            setCategories(prev => prev.filter(c => String(c._id) !== String(id)));
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete category');
        }
    };

    // Quick toggle status without opening modal
    const handleToggleStatus = async (cat) => {
        const newStatus = cat.status === 'active' ? 'inactive' : 'active';
        try {
            await api.put(`/api/categories/${cat._id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            // Socket event 'category-updated' will update the state
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to update status');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            if (editingCategory) {
                const res = await api.put(`/api/categories/${editingCategory._id}`, formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setCategories(prev => prev.map(c => c._id === editingCategory._id ? res.data : c));
            } else {
                const res = await api.post('/api/categories', formData, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setCategories(prev => prev.find(c => c._id === res.data._id) ? prev : [...prev, res.data]);
            }
            closeModal();
        } catch (error) {
            setFormError(error.response?.data?.message || 'Failed to save category');
        }
    };

    const openModal = (category = null) => {
        setFormError('');
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                color: category.color || '#3b82f6',
                status: category.status || 'active',
            });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '', color: '#3b82f6', status: 'active' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormError('');
    };

    const active = categories.filter(c => c.status === 'active');
    const inactive = categories.filter(c => c.status === 'inactive');

    return (
        <div className="space-y-6">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[var(--theme-bg-card2)] p-5 sm:p-6 rounded-xl shadow-lg border border-[var(--theme-border)]">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--theme-text-main)]">Categories</h2>
                    <p className="text-sm text-[var(--theme-text-muted)] mt-1">
                        {active.length} active · {inactive.length} inactive
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px] w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span>Add Category</span>
                </button>
            </div>

            {/* ── Category Cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                    <div
                        key={cat._id}
                        className={`bg-[var(--theme-bg-card)] p-6 rounded-xl border border-[var(--theme-border)] flex justify-between items-start group hover:border-blue-500/50 transition-colors ${cat.status === 'inactive' ? 'opacity-60' : ''}`}
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#3b82f6' }} />
                                <h3 className="font-bold text-[var(--theme-text-main)] text-lg truncate">{cat.name}</h3>
                            </div>
                            <p className="text-[var(--theme-text-muted)] text-sm mt-1 line-clamp-2">{cat.description}</p>

                            {/* Status toggle button */}
                            <button
                                onClick={() => handleToggleStatus(cat)}
                                className={`mt-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm transition-all ${
                                    cat.status === 'active'
                                        ? 'hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                                        : 'hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                                }`}
                                style={{
                                    backgroundColor: `${cat.color || '#3b82f6'}20`,
                                    color: cat.color || '#3b82f6',
                                    borderColor: `${cat.color || '#3b82f6'}40`,
                                }}
                                title={cat.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                            >
                                {cat.status === 'active' ? '● Active' : '○ Inactive'}
                            </button>
                        </div>

                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                            <button
                                onClick={() => openModal(cat)}
                                className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded transition-colors"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={() => handleDelete(cat._id)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Modal ────────────────────────────────────────────────── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--theme-bg-card)] p-5 sm:p-8 rounded-xl w-full max-w-md shadow-2xl border border-[var(--theme-border)] animate-fade-in">
                        <h3 className="text-xl font-bold text-[var(--theme-text-main)] mb-6">
                            {editingCategory ? 'Edit Category' : 'Add Category'}
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

                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-2">Category Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {presetColors.map(c => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.hex })}
                                            className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Status toggle */}
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-2">Status</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: 'active' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${formData.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}`}
                                    >
                                        ● Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${formData.status === 'inactive' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-[var(--theme-bg-dark)] text-[var(--theme-text-muted)] border-[var(--theme-border)]'}`}
                                    >
                                        ○ Inactive
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--theme-text-muted)] mt-1">
                                    Inactive categories are hidden from the ordering screen
                                </p>
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold">
                                    {editingCategory ? 'Update Category' : 'Add Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCategories;

