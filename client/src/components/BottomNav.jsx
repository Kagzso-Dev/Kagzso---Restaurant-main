import { memo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    LayoutDashboard, Utensils, ChefHat, Monitor,
    ClipboardList, Settings, Package
} from 'lucide-react';

/**
 * Mobile-only Bottom Navigation Bar
 * Visible only on screens < 1025px (hidden via CSS on desktop)
 */
const BottomNav = memo(() => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    if (!user) return null;

    const isActive = (path) => location.pathname === path;

    // Build nav items per role
    const getNavItems = () => {
        if (user.role === 'admin') {
            return [
                { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
                { to: '/admin/orders', icon: ClipboardList, label: 'Orders' },
                { to: '/admin/tables', icon: Monitor, label: 'Tables' },
                { to: '/admin/menu', icon: Utensils, label: 'Menu' },
                { to: '/admin/settings', icon: Settings, label: 'Settings' },
            ];
        }
        if (user.role === 'kitchen') {
            return [
                { to: '/kitchen', icon: ChefHat, label: 'Kitchen' },
            ];
        }
        if (user.role === 'cashier') {
            return [
                { to: '/cashier', icon: Monitor, label: 'POS' },
                { to: '/cashier/working-process', icon: ClipboardList, label: 'Orders' },
                { to: '/cashier/kitchen-view', icon: ChefHat, label: 'Kitchen' },
            ];
        }
        if (user.role === 'waiter') {
            return [
                { to: '/waiter', icon: LayoutDashboard, label: 'Dashboard' },
                { to: '/dine-in', icon: Utensils, label: 'Dine In' },
                { to: '/take-away', icon: Package, label: 'Take Away' },
                { to: '/waiter/kitchen-view', icon: ChefHat, label: 'Kitchen' },
            ];
        }
        return [];
    };

    const navItems = getNavItems();

    return (
        <nav className="
            lg:hidden fixed bottom-0 left-0 right-0 z-40
            bg-[var(--theme-sidebar-bg)]/95 backdrop-blur-lg
            border-t border-[var(--theme-border)]
            flex items-stretch
            bottom-nav-safe
            shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.5)]
        ">
            {navItems.map(({ to, icon: Icon, label }) => {
                const active = isActive(to);
                return (
                    <button
                        key={to}
                        onClick={() => navigate(to)}
                        className={`
                            flex-1 flex flex-col items-center justify-center
                            py-2 gap-1 min-h-[56px] transition-colors duration-200 tap-scale
                            ${active
                                ? 'text-orange-400'
                                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] transition-colors'
                            }
                        `}
                        aria-label={label}
                    >
                        {active && (
                            <span className="absolute top-0 h-0.5 w-10 bg-orange-500 rounded-full" style={{ left: '50%', transform: 'translateX(-50%)' }} />
                        )}
                        <Icon
                            size={21}
                            className="flex-shrink-0"
                            strokeWidth={active ? 2.5 : 1.8}
                        />
                        <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-orange-400' : ''}`}>
                            {label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
});

export default BottomNav;
