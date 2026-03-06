import { useState, useContext, useCallback, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { Outlet, Navigate } from 'react-router-dom';

/**
 * Responsive Layout
 *
 * Mobile  (<768px):  No sidebar. Full-width content + BottomNav bar.
 *                    Hamburger opens slide-in Drawer.
 * Tablet  (768-1024): Collapsible sidebar (icon-only by default), TopBar visible.
 * Desktop (1025px+): Permanent full sidebar, no BottomNav.
 */
const Layout = () => {
    const { user, loading } = useContext(AuthContext);

    // Controls whether the sidebar drawer is open on mobile
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Check initial window width to determine if sidebar should be collapsed
    const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1025);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth >= 768 && window.innerWidth < 1025);

    const openDrawer = useCallback(() => {
        setDrawerOpen(true);
        document.body.classList.add('drawer-open');
    }, []);

    const closeDrawer = useCallback(() => {
        setDrawerOpen(false);
        document.body.classList.remove('drawer-open');
    }, []);

    // Resize listener for state updates
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const tabletRange = width >= 768 && width < 1025;
            setIsTablet(tabletRange);

            if (width >= 1025) {
                closeDrawer();
                setSidebarCollapsed(false);
            } else if (tabletRange) {
                setSidebarCollapsed(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [closeDrawer]);

    // ── Auth Guards ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--theme-bg-dark)' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--theme-text-muted)] text-sm font-medium tracking-wide">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen text-[var(--theme-text-main)] font-sans overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-dark)' }}>

            {/* ── Mobile: Overlay backdrop when drawer open ─────── */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={closeDrawer}
                    aria-hidden="true"
                />
            )}

            {/* ── Sidebar ───────────────────────────────────────────────── */}
            {/*
             * Mobile (<768):  hidden by default, slides in as drawer
             * Tablet (768-1024): collapsible sidebar (default icon-only)
             * Desktop (1025+): permanent sidebar
             */}
            <aside
                className={`
                    fixed top-0 left-0 h-full z-50
                    transition-all duration-300 ease-in-out
                    ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0 md:relative md:flex-shrink-0
                `}
                style={{
                    width: sidebarCollapsed ? '80px' : '288px',
                    minWidth: sidebarCollapsed ? '80px' : '288px',
                }}
            >
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed(c => !c)}
                    onClose={closeDrawer}
                />
            </aside>

            {/* ── Main Content Area ────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar with hamburger menu trigger */}
                <TopBar onMenuClick={openDrawer} sidebarCollapsed={sidebarCollapsed} />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="p-4 md:p-6 lg:p-8 pb-24 md:pb-8 animate-fade-in">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* ── Mobile Bottom Nav ────────────────────────────────────── */}
            {/* Only show on mobile screens (<768px) where sidebar is drawer */}
            <div className="md:hidden">
                <BottomNav />
            </div>
        </div>
    );
};

export default Layout;

