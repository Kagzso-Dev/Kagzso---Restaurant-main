import logoImg from '../assets/logo.png';

const Logo = ({ size = 'md', showText = true }) => {
    const { settings } = useContext(AuthContext);
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24'
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <div className={`${sizeClasses[size]} bg-white rounded-xl flex items-center justify-center shadow-lg p-1 border border-gray-200`}>
                <img src={logoImg} alt="KAGSZO" className="w-full h-full object-contain" />
            </div>
            {showText && (
                <div className="text-center mt-3">
                    <h1 className="text-2xl font-black text-[var(--theme-text-main)] tracking-widest uppercase">{settings.restaurantName || 'KAGSZO'}</h1>
                    <p className="text-xs text-[var(--theme-text-muted)] font-bold uppercase tracking-widest">Management POS System</p>
                </div>
            )}
        </div>
    );
};

export default Logo;

