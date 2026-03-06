import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Trash2, Plus, Edit2 } from 'lucide-react';

const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: '#3b82f6' });
    const { user } = useContext(AuthContext);

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

    const fetchCategories = async () => {
        try {
            const res = await api.get('/api/categories');
            setCategories(res.data);
        } catch (error) {
            console.error("Error fetching categories", error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category?')) return;
        try {
            await api.delete(`/api/categories/${id}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setCategories(categories.filter(c => c._id !== id));
        } catch (error) {
            console.error(error);
            alert("Error deleting category");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                const res = await api.put(`/api/categories/${editingCategory._id}`, formData, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setCategories(categories.map(c => c._id === editingCategory._id ? res.data : c));
            } else {
                const res = await api.post('/api/categories', formData, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setCategories([...categories, res.data]);
            }
            closeModal();
        } catch (error) {
            console.error(error);
            alert("Error saving category");
        }
    };

    const openModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({ name: category.name, description: category.description, color: category.color || '#3b82f6' });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '', color: '#3b82f6' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-[var(--theme-bg-card2)] p-5 sm:p-6 rounded-xl shadow-lg border border-[var(--theme-border)]">
                <h2 className="text-2xl font-bold text-[var(--theme-text-main)]">Categories</h2>
                <button
                    onClick={() => openModal()}
                    className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px] w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span>Add Category</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                    <div key={cat._id} className="bg-[var(--theme-bg-card)] p-6 rounded-xl border border-[var(--theme-border)] flex justify-between items-start group hover:border-blue-500/50 transition-colors">
                        <div>
                            <h3 className="font-bold text-[var(--theme-text-main)] text-lg">{cat.name}</h3>
                            <p className="text-[var(--theme-text-muted)] text-sm mt-1">{cat.description}</p>
                            <span
                                className="inline-block mt-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm"
                                style={{
                                    backgroundColor: `${cat.color || '#3b82f6'}20`,
                                    color: cat.color || '#3b82f6',
                                    borderColor: `${cat.color || '#3b82f6'}40`
                                }}
                            >
                                {cat.status || 'Active'}
                            </span>
                        </div>
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openModal(cat)} className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded transition-colors">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(cat._id)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[var(--theme-bg-card)] p-5 sm:p-8 rounded-xl w-full max-w-md mx-4 sm:mx-0 shadow-2xl border border-[var(--theme-border)] animate-fade-in">
                        <h3 className="text-xl font-bold text-[var(--theme-text-main)] mb-6">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" rows="2"></textarea>
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

                            <div className="flex justify-end space-x-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] hover:bg-[var(--theme-bg-hover)] rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCategories;

