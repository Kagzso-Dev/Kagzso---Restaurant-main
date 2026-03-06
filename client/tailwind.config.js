/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdba74',
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#ea580c',
                    700: '#c2410c',
                    800: '#9a3412',
                    900: '#7c2d12',
                },
                surface: {
                    900: '#0a0f1e',
                    850: '#0d1526',
                    800: '#0f172a',
                    750: '#111827',
                    700: '#1e293b',
                    600: '#243048',
                    500: '#334155',
                },
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui'],
            },
            screens: {
                'xs': '375px',
                'sm': '640px',
                'md': '768px',
                'lg': '1025px',
                'xl': '1280px',
                '2xl': '1536px',
            },
            spacing: {
                'safe-bottom': 'env(safe-area-inset-bottom)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out forwards',
                'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
                'slide-out-left': 'slideOutLeft 0.3s ease-out forwards',
                'slide-up': 'slideUp 0.25s ease-out forwards',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-in': 'bounceIn 0.4s ease-out forwards',
                'shimmer': 'shimmer 1.5s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInLeft: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' },
                },
                slideOutLeft: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-100%)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                bounceIn: {
                    '0%': { transform: 'scale(0.6)', opacity: '0' },
                    '70%': { transform: 'scale(1.05)' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            boxShadow: {
                'glow-orange': '0 0 20px rgba(249, 115, 22, 0.3)',
                'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
                'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
                'card': '0 4px 24px -6px rgba(0,0,0,0.4)',
                'card-hover': '0 8px 32px -8px rgba(0,0,0,0.5)',
                'sidebar': '4px 0 24px rgba(0,0,0,0.4)',
            },
        },
    },
    plugins: [],
}
