import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { Trash2, Edit, Plus, Search } from 'lucide-react';
import ViewToggle from '../../components/ViewToggle';
import FoodItem from '../../components/FoodItem';


const AdminMenu = () => {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const { user, formatPrice } = useContext(AuthContext);

    // Form state
    const [formData, setFormData] = useState({
        name: '', description: '', price: '', category: '', image: '', isVeg: true
    });
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('adminMenuViewMode') || 'grid');

    useEffect(() => {
        localStorage.setItem('adminMenuViewMode', viewMode);
    }, [viewMode]);


    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [menuRes, catRes] = await Promise.all([
                api.get('/api/menu'),
                api.get('/api/categories')
            ]);
            setItems(menuRes.data);
            setCategories(catRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await api.delete(`/api/menu/${id}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setItems(items.filter(i => i._id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingItem) {
                const res = await api.put(`/api/menu/${editingItem._id}`, formData, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setItems(items.map(i => i._id === editingItem._id ? res.data : i));
            } else {
                const res = await api.post('/api/menu', formData, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setItems([...items, res.data]);
            }
            closeModal();
        } catch (error) {
            console.error(error);
            alert("Error saving item");
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                description: item.description,
                price: item.price,
                category: item.category?._id || item.category, // Handle populated
                image: item.image,
                isVeg: item.isVeg
            });
        } else {
            setEditingItem(null);
            setFormData({ name: '', description: '', price: '', category: categories[0]?._id || '', image: '', isVeg: true });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--theme-bg-card2)] p-6 rounded-xl shadow-lg border border-[var(--theme-border)] gap-4">
                <h2 className="text-2xl font-bold text-[var(--theme-text-main)]">Menu Management</h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                    <button
                        onClick={() => openModal()}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[40px]"
                    >
                        <Plus size={18} />
                        <span>Add Item</span>
                    </button>
                </div>
            </div>

            <div className={`
                ${viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                    : 'flex flex-col gap-4'
                }
            `}>
                {items.map(item => (
                    <FoodItem
                        key={item._id}
                        item={item}
                        viewMode={viewMode}
                        formatPrice={formatPrice}
                        onEdit={openModal}
                        onDelete={handleDelete}
                        isAdmin={true}
                    />
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[var(--theme-bg-card)] p-5 sm:p-8 rounded-xl w-full max-w-lg mx-4 sm:mx-0 shadow-2xl border border-[var(--theme-border)] animate-fade-in">
                        <h3 className="text-xl font-bold text-[var(--theme-text-main)] mb-6">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" rows="2"></textarea>
                            </div>
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Price</label>
                                    <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Category</label>
                                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500">
                                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--theme-text-muted)] mb-1">Image URL</label>
                                <input type="text" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-lg p-2 border border-[var(--theme-border)] focus:border-blue-500" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" checked={formData.isVeg} onChange={e => setFormData({ ...formData, isVeg: e.target.checked })} className="w-4 h-4 rounded bg-[var(--theme-bg-dark)] border-[var(--theme-border)]" />
                                <span className="text-[var(--theme-text-main)] text-sm">Vegetarian</span>
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

export default AdminMenu;

