import { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

/**
 * useTablesData
 *
 * Single source of truth for table data.
 * - Fetches from GET /api/tables (same endpoint for Admin + Waiter).
 * - Subscribes to socket event 'table-updated' for live sync.
 * - Both Admin and Waiter pages should use this hook; no separate state needed.
 *
 * Returns: { tables, setTables, loading, fetchTables }
 */
export const useTablesData = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user, socket } = useContext(AuthContext);

    const fetchTables = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const res = await api.get('/api/tables', {
                headers: { Authorization: `Bearer ${user.token}` },
            });
            // Always ensure we have an array
            setTables(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('[useTablesData] Failed to fetch tables:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTables();

        if (socket) {
            // Live update: mutate only the changed table, no full refetch needed
            const handler = (data) => {
                setTables((prev) =>
                    prev.map((t) =>
                        t._id === data.tableId
                            ? { ...t, status: data.status, lockedBy: data.lockedBy ?? null }
                            : t
                    )
                );
            };
            socket.on('table-updated', handler);
            return () => socket.off('table-updated', handler);
        }
    }, [user, socket, fetchTables]);

    return { tables, setTables, loading, fetchTables };
};
