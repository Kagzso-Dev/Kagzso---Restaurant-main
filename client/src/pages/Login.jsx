import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, CheckCircle } from 'lucide-react';
import logoImg from '../assets/logo.png';

// Helper: get dashboard path by role
const getDashboardPath = (role) => {
    switch (role) {

        case 'admin': return '/admin';
        case 'kitchen': return '/kitchen';
        case 'cashier': return '/cashier';
        case 'waiter': return '/waiter';
        default: return '/';
    }
};

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const { user, login, loading, settings, serverStatus } = useContext(AuthContext);
    const navigate = useNavigate();

    // If user is already logged in, redirect to their dashboard
    useEffect(() => {
        if (!loading && user) {
            navigate(getDashboardPath(user.role), { replace: true });
        }
    }, [user, loading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userData = await login(username, password);
            navigate(getDashboardPath(userData.role), { replace: true });
        } catch (err) {
            console.error(err);
            setError(typeof err === 'string' ? err : (err.message || 'Login failed'));
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--theme-bg-dark)] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 -right-32 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
            </div>

            {/* Logo Section */}
            <div className="mb-6 sm:mb-8 z-10 flex flex-col items-center animate-fade-in-down px-4 text-center">
                <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-4">
                        <img src={logoImg} alt="KAGSZO" className="w-full h-full object-contain" />
                    </div>
                    {/* Connection Status Dot */}
                    <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-4 border-[var(--theme-bg-dark)] ${serverStatus === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`}
                        title={serverStatus === 'online' ? 'Server Connected' : 'Server Offline'}
                    ></div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--theme-text-main)] tracking-widest uppercase">{settings.restaurantName || 'KAGSZO'}</h1>
                <p className="text-[10px] sm:text-sm text-[var(--theme-text-muted)] font-medium tracking-wider uppercase mt-1">Smart POS & Kitchen Management</p>
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--theme-bg-muted)] border border-[var(--theme-border)]">
                    <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter text-[var(--theme-text-subtle)]">
                        {serverStatus === 'online' ? 'System Online' : 'Connecting to Server...'}
                    </span>
                </div>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-[calc(100%-2rem)] sm:max-w-md bg-[var(--theme-bg-card)] p-6 sm:p-8 rounded-2xl shadow-2xl border border-[var(--theme-border)] z-10 animate-fade-in-up">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-[var(--theme-text-main)] mb-2">Welcome back</h2>
                    <p className="text-[var(--theme-text-muted)] text-sm">Sign in to your account to continue</p>
                </div>

                {error && (
                    <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center">
                        <span className="mr-2">⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-[var(--theme-text-subtle)] uppercase mb-2 tracking-wider">Username</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--theme-text-subtle)] group-focus-within:text-orange-500 transition-colors">
                                <User size={18} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)] transition-all outline-none"
                                placeholder="Enter username"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--theme-text-subtle)] uppercase mb-2 tracking-wider">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--theme-text-subtle)] group-focus-within:text-orange-500 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-[var(--theme-bg-dark)] border border-[var(--theme-border)] rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-[var(--theme-text-main)] placeholder-[var(--theme-text-subtle)] transition-all outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Sign In
                    </button>

                </form>
            </div>

            {/* Quick Demo Login */}
            <div className="mt-8 z-10 w-full max-w-md animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between gap-4">
                    <div className="h-px bg-[var(--theme-border)] flex-1"></div>
                    <span className="text-[var(--theme-text-subtle)] text-xs font-bold uppercase tracking-widest">Quick Demo Login</span>
                    <div className="h-px bg-[var(--theme-border)] flex-1"></div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                    <button type="button" onClick={() => { setUsername('admin'); setPassword('admin123'); }} className="flex flex-col items-center justify-center p-3 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-hover)] rounded-xl border border-[var(--theme-border)] transition-all group tap-scale">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2 group-hover:bg-purple-500 group-hover:text-white transition-colors">A</div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-medium uppercase">Admin</span>
                    </button>
                    <button type="button" onClick={() => { setUsername('waiter'); setPassword('waiter123'); }} className="flex flex-col items-center justify-center p-3 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-hover)] rounded-xl border border-[var(--theme-border)] transition-all group tap-scale">
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center mb-2 group-hover:bg-pink-500 group-hover:text-white transition-colors">W</div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-medium uppercase">Waiter</span>
                    </button>
                    <button type="button" onClick={() => { setUsername('kitchen'); setPassword('kitchen123'); }} className="flex flex-col items-center justify-center p-3 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-hover)] rounded-xl border border-[var(--theme-border)] transition-all group tap-scale">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors">K</div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-medium uppercase">Kitchen</span>
                    </button>
                    <button type="button" onClick={() => { setUsername('cashier'); setPassword('cashier123'); }} className="flex flex-col items-center justify-center p-3 bg-[var(--theme-bg-card)] hover:bg-[var(--theme-bg-hover)] rounded-xl border border-[var(--theme-border)] transition-all group tap-scale">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-2 group-hover:bg-green-500 group-hover:text-white transition-colors">C</div>
                        <span className="text-[10px] text-[var(--theme-text-muted)] font-medium uppercase">Cashier</span>
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 text-center text-xs text-[var(--theme-text-subtle)] z-10">
                &copy; {new Date().getFullYear()} {settings.restaurantName} Management System. All rights reserved.
            </div>

            {/* Custom Toast Mockup (Top Right) */}
            <div className="absolute top-6 right-6 bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-lg shadow-xl p-4 flex items-center gap-3 animate-slide-in-right opacity-0 pointer-events-none hidden">
                <CheckCircle size={20} className="text-green-500" />
                <div>
                    <h4 className="text-[var(--theme-text-main)] text-sm font-semibold">System Ready</h4>
                    <p className="text-[var(--theme-text-muted)] text-xs">Connected to server securely.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;

