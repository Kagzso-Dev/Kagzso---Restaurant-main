import { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Save, Lock, Settings as SettingsIcon, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';

const Settings = () => {
    const { user, settings, fetchSettings } = useContext(AuthContext);
    const [generalConfig, setGeneralConfig] = useState({
        restaurantName: '',
        currency: 'USD',
        currencySymbol: '$',
        taxRate: 5,
        gstNumber: ''
    });

    const [passwordData, setPasswordData] = useState({
        role: 'admin',
        newPassword: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Auto-dismiss toast after 5 seconds
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(null), 5000);
        return () => clearTimeout(timer);
    }, [message]);

    useEffect(() => {
        if (settings) {
            setGeneralConfig({
                restaurantName: settings.restaurantName || '',
                currency: settings.currency || 'USD',
                currencySymbol: settings.currencySymbol || '$',
                taxRate: settings.taxRate || 0,
                gstNumber: settings.gstNumber || ''
            });
        }
    }, [settings]);

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        setGeneralConfig(prev => ({ ...prev, [name]: value }));

        // Auto-set symbol based on currency selection
        if (name === 'currency') {
            let symbol = '$';
            if (value === 'INR') symbol = '₹';
            if (value === 'EUR') symbol = '€';
            setGeneralConfig(prev => ({ ...prev, [name]: value, currencySymbol: symbol }));
        }
    };

    const handleConfigSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/api/settings', generalConfig, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            await fetchSettings(); // Refresh context
            setMessage({ type: 'success', text: 'Settings updated successfully!' });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to update settings.' });
        }
        setLoading(false);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match!' });
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/settings/change-password',
                {
                    role: passwordData.role,
                    newPassword: passwordData.newPassword
                },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setMessage({ type: 'success', text: `Password for ${passwordData.role} updated successfully!` });
            setPasswordData({ role: 'admin', newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to change password.' });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[var(--theme-text-main)] flex items-center gap-3">
                <SettingsIcon className="text-[var(--theme-text-muted)]" />
                System Settings
            </h2>

            {message && (
                <div className={`
                    fixed top-20 right-6 z-[100] min-w-[320px] 
                    p-4 rounded-2xl shadow-2xl border flex items-center gap-3 
                    animate-slide-in-right transform transition-all
                    ${message.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }
                `}>
                    {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <div>
                        <p className="font-bold text-sm uppercase tracking-wider">{message.type === 'success' ? 'Success' : 'Attention'}</p>
                        <p className="text-xs opacity-80">{message.text}</p>
                    </div>
                    <button onClick={() => setMessage(null)} className="ml-auto opacity-40 hover:opacity-100 transition-opacity">
                        <Save className="rotate-45" size={14} />
                    </button>
                </div>
            )}

            {/* General Configuration */}
            <div className="bg-[var(--theme-bg-card)] rounded-3xl shadow-xl border border-[var(--theme-border)] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/5 px-5 py-4 sm:px-8 sm:py-5 border-b border-[var(--theme-border)] flex items-center justify-between">
                    <h3 className="text-lg font-black text-[var(--theme-text-main)] flex items-center gap-2 uppercase tracking-widest">
                        <DollarSign size={20} className="text-blue-500" />
                        Business Profile
                    </h3>
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">PUBLIC INFO</span>
                </div>

                <form onSubmit={handleConfigSubmit} className="p-5 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">Restaurant Name</label>
                            <input
                                type="text"
                                name="restaurantName"
                                value={generalConfig.restaurantName}
                                onChange={handleConfigChange}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium"
                                placeholder="Enter Brand Name"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">Currency</label>
                            <div className="relative">
                                <select
                                    name="currency"
                                    value={generalConfig.currency}
                                    onChange={handleConfigChange}
                                    className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-blue-500 transition-all outline-none font-medium appearance-none"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="EUR">EUR (€)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                    <DollarSign size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">Tax Rate (%)</label>
                            <input
                                type="number"
                                name="taxRate"
                                value={generalConfig.taxRate}
                                onChange={handleConfigChange}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">GST/VAT Number</label>
                            <input
                                type="text"
                                name="gstNumber"
                                value={generalConfig.gstNumber}
                                onChange={handleConfigChange}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-medium uppercase"
                                placeholder="e.g. 29ABCDE1234F1Z5"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-5 border-t border-[var(--theme-border)]">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2.5 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:bg-gray-700 uppercase text-xs tracking-widest"
                        >
                            <Save size={18} />
                            <span>Apply Changes</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Security Settings */}
            <div className="bg-[var(--theme-bg-card)] rounded-3xl shadow-xl border border-[var(--theme-border)] overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500/10 to-red-500/5 px-5 py-4 sm:px-8 sm:py-5 border-b border-[var(--theme-border)] flex items-center justify-between">
                    <h3 className="text-lg font-black text-[var(--theme-text-main)] flex items-center gap-2 uppercase tracking-widest">
                        <Lock size={20} className="text-orange-500" />
                        Access & Security
                    </h3>
                    <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">PROTECTED</span>
                </div>

                <form onSubmit={handlePasswordSubmit} className="p-5 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">Staff Role</label>
                            <select
                                value={passwordData.role}
                                onChange={(e) => setPasswordData({ ...passwordData, role: e.target.value })}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-orange-500 transition-all outline-none font-medium"
                            >
                                <option value="admin">Admin</option>
                                <option value="waiter">Waiter</option>
                                <option value="kitchen">Kitchen</option>
                                <option value="cashier">Cashier</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">New Password</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-orange-500 outline-none transition-all font-medium"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-subtle)] ml-1">Verify Password</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="w-full bg-[var(--theme-bg-dark)] text-[var(--theme-text-main)] rounded-2xl p-4 border border-[var(--theme-border)] focus:border-orange-500 outline-none transition-all font-medium"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-5 border-t border-[var(--theme-border)]">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2.5 px-8 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:bg-gray-700 uppercase text-xs tracking-widest"
                        >
                            <Save size={18} />
                            <span>Update Security</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;

