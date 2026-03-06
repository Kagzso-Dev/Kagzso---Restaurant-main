import { createContext, useState, useEffect, useCallback } from 'react';
import api, { baseURL as API_BASE } from '../api';
import { io } from 'socket.io-client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // ── Synchronous session restore ───────────────────────────────────────────
    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [loading, setLoading] = useState(false);
    const [socket, setSocket] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [serverStatus, setServerStatus] = useState('online');
    const [settings, setSettings] = useState({
        restaurantName: 'Restaurant',
        currency: 'INR',
        currencySymbol: '₹',
        taxRate: 5,
        gstNumber: '',
    });

    // ── Socket init (joins restaurant-specific + role-specific rooms) ──────────
    const initSocket = useCallback((role) => {
        if (socket) socket.disconnect();

        const newSocket = io(API_BASE, {
            transports: ['websocket', 'polling'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });

        const joinRooms = () => {
            newSocket.emit('join-branch');
            console.log('%c✅ Socket connected to restaurant main room', 'color: #10b981; font-weight: bold;');

            if (role) {
                newSocket.emit('join-role', role);
                console.log('%c✅ Socket role-room joined:', 'color: #3b82f6; font-weight: bold;', `role_${role}`);
            }
        };

        newSocket.on('connect', () => {
            setSocketConnected(true);
            setServerStatus('online');
            joinRooms();
        });

        newSocket.on('reconnect', (attempt) => {
            setSocketConnected(true);
            setServerStatus('online');
            console.log(`🔄 Socket reconnected (${attempt}) — re-syncing state`);
            joinRooms();
        });

        newSocket.on('disconnect', (reason) => {
            setSocketConnected(false);
            if (reason === 'io server disconnect') {
                newSocket.connect();
            }
            console.warn(`⚠️ Socket disconnected: ${reason}`);
        });

        newSocket.on('connect_error', (err) => {
            setSocketConnected(false);
            setServerStatus('offline');
            console.error('❌ Socket connection error:', err.message);
        });

        setSocket(newSocket);
        return newSocket;
    }, [socket]);

    // ── Fetch settings ────────────────────────────────────────────────────────
    const fetchSettings = useCallback(async () => {
        try {
            const res = await api.get('/api/settings');
            setSettings(res.data);
            setServerStatus('online');
        } catch (error) {
            console.warn('⚠️ Settings fetch failed:', error.message);
            if (!error.response) setServerStatus('offline');
        }
    }, []);

    // ── Side effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (user) {
            initSocket(user.role);
            fetchSettings();
        } else {
            fetchSettings();
        }

        return () => {
            if (socket) socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (username, password) => {
        setLoading(true);
        try {
            const res = await api.post('/api/auth/login', { username, password });
            const userData = res.data;

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));

            initSocket(userData.role);
            fetchSettings();

            setLoading(false);
            return userData;
        } catch (error) {
            setLoading(false);
            const msg = error.response?.data?.message || error.message || 'Login failed';
            throw msg;
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        if (socket) socket.disconnect();
        setSocket(null);
        setSocketConnected(false);
        setSettings({
            restaurantName: 'Restaurant',
            currency: 'INR',
            currencySymbol: '₹',
            taxRate: 5,
            gstNumber: '',
        });
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatPrice = (amount) => {
        return `${settings.currencySymbol}${(amount || 0).toFixed(2)}`;
    };

    const role = user?.role || null;
    const isAdmin = role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            loading,
            socket,
            socketConnected,
            serverStatus,
            settings,
            fetchSettings,
            formatPrice,
            role,
            isAdmin,
        }}>
            {children}
        </AuthContext.Provider>
    );
};


