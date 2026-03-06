import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// ── Loading spinner while auth state is being restored ───────────────────────
const AuthLoading = () => (
    <div className="flex items-center justify-center min-h-screen bg-[#0F172A]">
        <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 text-sm font-medium">Restoring session...</p>
        </div>
    </div>
);

// ── Maps a role to its home dashboard path ────────────────────────────────────
const getDashboardPath = (role) => {
    switch (role) {

        case 'admin': return '/admin';
        case 'kitchen': return '/kitchen';
        case 'cashier': return '/cashier';
        case 'waiter': return '/waiter';
        default: return '/login';
    }
};

// ── Helper: role-based route guard ───────────────────────────────────────────
const RoleRoute = ({ allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);

    // Wait until auth state is restored from localStorage
    if (loading) return <AuthLoading />;

    // No user = not logged in → redirect to login
    if (!user) return <Navigate to="/login" replace />;

    // Role is allowed → render the page
    if (allowedRoles.includes(user.role)) {
        return <Outlet />;
    }

    // Role mismatch → silently redirect to the user's own dashboard
    // (avoids showing an "Access Denied" screen for routine navigation)
    return <Navigate to={getDashboardPath(user.role)} replace />;
};

// ── Individual route guards ──────────────────────────────────────────────────


const AdminRoute = () => (
    <RoleRoute allowedRoles={['admin']} />
);

const KitchenRoute = () => (
    <RoleRoute allowedRoles={['kitchen', 'admin']} />
);

const CashierRoute = () => (
    <RoleRoute allowedRoles={['cashier', 'admin']} />
);

const WaiterRoute = () => (
    <RoleRoute allowedRoles={['waiter', 'admin']} />
);

export { AdminRoute, KitchenRoute, CashierRoute, WaiterRoute };
