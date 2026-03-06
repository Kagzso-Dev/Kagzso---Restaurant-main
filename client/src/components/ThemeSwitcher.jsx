import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeSwitcher = ({ collapsed = false }) => {
    const { theme: currentTheme, setTheme, themes: THEMES } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const handleThemeChange = (id) => {
        setTheme(id);
        setOpen(false);
    };

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const current = THEMES.find(t => t.id === currentTheme);

    return (
        <div ref={ref} className="relative flex-shrink-0">
            <button
                onClick={() => setOpen(o => !o)}
                title={collapsed ? `Theme: ${current?.label}` : undefined}
                aria-label="Switch theme"
                className={`
                    flex items-center gap-2.5 rounded-xl transition-all duration-200 min-h-[44px]
                    text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)]
                    hover:bg-[var(--theme-bg-hover)]
                    border border-transparent hover:border-[var(--theme-border)]
                    ${open ? 'bg-[var(--theme-bg-hover)] border-[var(--theme-border)] text-[var(--theme-text-main)]' : ''}
                    ${collapsed ? 'w-11 h-11 justify-center p-0' : 'w-full px-4 py-2.5'}
                `}
            >
                <Palette size={17} className="flex-shrink-0" />
                {!collapsed && (
                    <>
                        <span className="font-semibold text-sm flex-1 text-left">{current?.label}</span>
                        <span className="text-base leading-none">{current?.icon}</span>
                    </>
                )}
            </button>

            {open && (
                <div className="
                    absolute bottom-full left-0 mb-2 w-52
                    bg-[var(--theme-bg-card)] border border-[var(--theme-border)]
                    rounded-2xl shadow-2xl shadow-black/40
                    overflow-hidden z-[100] animate-scale-in
                ">
                    <div className="px-3 py-2.5 border-b border-[var(--theme-border)]">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--theme-text-muted)]">
                            Choose Theme
                        </p>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                        {THEMES.map(t => {
                            const active = t.id === currentTheme;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => handleThemeChange(t.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                        transition-all duration-150 text-left
                                        ${active
                                            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                            : 'hover:bg-[var(--theme-bg-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-main)] border border-transparent'
                                        }
                                    `}
                                    aria-pressed={active}
                                >
                                    <span className="text-lg leading-none flex-shrink-0">{t.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-tight">{t.label}</p>
                                        <p className="text-[10px] opacity-60 truncate mt-0.5">{t.description}</p>
                                    </div>
                                    {active && (
                                        <Check size={14} className="flex-shrink-0 text-orange-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeSwitcher;
