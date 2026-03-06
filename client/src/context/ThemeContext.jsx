import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * ── Theme System ──────────────────────────────────────────────────────────────
 *
 * THEMES registry — single place to add future themes.
 * Each entry: { id, label, icon (emoji), description }
 *
 * The `id` maps to a CSS class `.theme-{id}` in index.css.
 */
export const THEMES = [
    {
        id: 'default',
        label: 'Default',
        icon: '🌌',
        description: 'Blue-black premium dark',
    },
    {
        id: 'dark',
        label: 'Pure Dark',
        icon: '⚫',
        description: 'True black, maximum contrast',
    },
    {
        id: 'light',
        label: 'Light',
        icon: '☀️',
        description: 'Clean white, easy on eyes',
    },
];

const STORAGE_KEY = 'kagzso_theme';
const DEFAULT_THEME = 'light';

export const ThemeContext = createContext({
    theme: DEFAULT_THEME,
    setTheme: () => { },
    themes: THEMES,
});

/**
 * ThemeProvider
 *
 * - Wraps the entire app.
 * - Reads saved theme from localStorage on mount.
 * - Applies `.theme-{id}` class to <html> element.
 * - Smooth CSS transition is handled by the `* { transition: ... }` rule in index.css.
 */
export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return THEMES.find(t => t.id === saved) ? saved : DEFAULT_THEME;
    });

    // Apply theme class and attribute to <html> whenever it changes
    useEffect(() => {
        const html = document.documentElement;
        // Set data-theme attribute (for CSS variables)
        html.setAttribute('data-theme', theme);
        // Set theme class (for specific overrides)
        THEMES.forEach(t => html.classList.remove(`theme-${t.id}`));
        html.classList.add(`theme-${theme}`);
    }, [theme]);

    const setTheme = useCallback((id) => {
        if (!THEMES.find(t => t.id === id)) return; // guard invalid IDs
        localStorage.setItem(STORAGE_KEY, id);
        setThemeState(id);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
};

/**
 * useTheme — convenience hook
 * @returns {{ theme: string, setTheme: (id: string) => void, themes: typeof THEMES }}
 */
export const useTheme = () => useContext(ThemeContext);
