import { useState, useEffect } from 'react';

/**
 * useDebounce
 *
 * Returns a debounced version of `value` that only updates
 * after `delay` ms of no changes. Use this to avoid triggering
 * an API call on every keystroke.
 *
 * @param {any} value   - The value to debounce
 * @param {number} delay - Debounce delay in ms (default 400ms)
 * @returns {any} debouncedValue
 *
 * @example
 *   const debouncedQuery = useDebounce(searchQuery, 400);
 *   useEffect(() => { if (debouncedQuery) fetchSearch(debouncedQuery); }, [debouncedQuery]);
 */
const useDebounce = (value, delay = 400) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer); // Cleanup on value/delay change
    }, [value, delay]);

    return debouncedValue;
};

export default useDebounce;
