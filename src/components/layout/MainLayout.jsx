import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, Globe, LogOut as LogOutIcon, History, Menu, X, Monitor, Truck, Volume2, VolumeX } from 'lucide-react';
import { useProduct } from '../../contexts/ProductContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useShift } from '../../contexts/ShiftContext';
import { useOrder } from '../../contexts/OrderContext';
import CloseShiftModal from '../pos/CloseShiftModal';
import './MainLayout.css';

const MainLayout = () => {
    const { user, logout, isCashier } = useAuth();
    const { language, toggleLanguage, t } = useLanguage();
    const { isShiftOpen } = useShift();
    const { products } = useProduct();
    const { pendingOrdersActive } = useOrder();
    const [isCloseShiftOpen, setIsCloseShiftOpen] = React.useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);

    // Use useRef for the audio object to ensure it's persistent and doesn't trigger effect loops unnecessarily
    const audioRef = React.useRef(null);

    React.useEffect(() => {
        // Initialize audio if not already done
        if (!audioRef.current) {
            audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audioRef.current.loop = true;
            console.log("Audio system initialized");
        }

        const audio = audioRef.current;
        console.log(`Audio Status Update: isAudioEnabled=${isAudioEnabled}, pendingOrdersActive=${pendingOrdersActive}`);

        if (isAudioEnabled && pendingOrdersActive) {
            console.log("Attempting to play audio...");
            audio.play()
                .then(() => console.log("Audio playing successfully"))
                .catch(err => console.error("Audio play failed (likely browser block):", err));
        } else {
            console.log("Stopping audio...");
            audio.pause();
            audio.currentTime = 0;
        }

        return () => {
            audio.pause();
        };
    }, [isAudioEnabled, pendingOrdersActive]);

    const toggleAudio = () => {
        if (!isAudioEnabled) {
            console.log("Enabling audio - requiring user interaction...");
            // Initial play/pause to unlock audio in some browsers
            audioRef.current.play().then(() => {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                setIsAudioEnabled(true);
                alert("เปิดระบบเสียงเรียบร้อยแล้วครับ (Audio system enabled)");
            }).catch(e => {
                console.error("Audio unlock failed:", e);
                setIsAudioEnabled(true);
            });
        } else {
            console.log("Disabling audio alert");
            setIsAudioEnabled(false);
        }
    };

    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="layout-container">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="mobile-menu-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <h2>{t('appName')}</h2>
                    <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {!isCashier && (
                        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <LayoutDashboard size={20} />
                            <span>{t('dashboard')}</span>
                        </NavLink>
                    )}

                    <NavLink to="/pos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ShoppingCart size={20} />
                        <span>{t('pos')}</span>
                    </NavLink>

                    {!isCashier && (
                        <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Package size={20} />
                            <span>{t('inventory')}</span>
                        </NavLink>
                    )}



                    <NavLink to="/customers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>{t('customers')}</span>
                    </NavLink>

                    <NavLink to="/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Truck size={20} />
                        <span>{t('orders')}</span>
                    </NavLink>

                    {!isCashier && (
                        <NavLink to="/shift-history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <History size={20} />
                            <span>{t('shiftHistory')}</span>
                        </NavLink>
                    )}

                    <div className="nav-divider" />

                    {!isCashier && (
                        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Settings size={20} />
                            <span>{t('settings')}</span>
                        </NavLink>
                    )}
                </nav>

                <div className="sidebar-footer">
                    {isShiftOpen && (
                        <button className="nav-item close-shift-btn" onClick={() => setIsCloseShiftOpen(true)}>
                            <LogOutIcon size={20} className="text-danger" />
                            <span>{t('closeShift')}</span>
                        </button>
                    )}
                    <button className="nav-item logout-btn" onClick={handleLogout}>
                        <LogOut size={20} />
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <button
                            className="mobile-menu-toggle"
                            onClick={() => {
                                if (window.innerWidth > 768) {
                                    setIsCollapsed(!isCollapsed);
                                } else {
                                    setIsMobileMenuOpen(true);
                                }
                            }}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="page-title">{t('welcome')}, {user?.name || 'User'}</h1>
                    </div>
                    <div className="header-actions">
                        {/* Cloud Status Indicator */}
                        {/* Cloud Status Indicator */}
                        <div className="status-indicator" title={products?.length > 0 ? t('connected') : t('disconnected')}>
                            {products?.length > 0 ? (
                                <Globe size={20} color="var(--success)" />
                            ) : (
                                <Globe size={20} color="var(--danger)" />
                            )}
                        </div>



                        {/* POS Shortcut */}
                        <button
                            className="header-icon-btn"
                            onClick={() => navigate('/pos')}
                            title={t('openPOS')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <ShoppingCart size={20} />
                        </button>

                        {/* Customer Display Button */}
                        <button
                            className="header-icon-btn"
                            onClick={() => {
                                const win = window.open('/customer-display', 'CustomerDisplay', 'width=800,height=600');
                                if (!win) {
                                    alert('Popups are blocked! Please allow popups for this site.');
                                }
                            }}
                            title={t('openCustomerDisplay')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                marginRight: '1rem'
                            }}
                        >
                            <Monitor size={20} />
                        </button>

                        <button
                            className={`header-icon-btn ${isAudioEnabled && pendingOrdersActive ? 'alert-pulse' : ''}`}
                            onClick={toggleAudio}
                            title={isAudioEnabled ? t('disableSound') : t('enableSound')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: isAudioEnabled ? (pendingOrdersActive ? '#ef4444' : '#10b981') : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                            <span style={{ fontSize: '0.7rem' }}>{isAudioEnabled ? 'ON' : 'OFF'}</span>
                        </button>

                        <div className="user-profile">
                            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{user?.role}</span>
                        </div>
                    </div>
                </header>
                <div className="content-wrapper">
                    <Outlet />
                </div>
            </main>

            <CloseShiftModal
                isOpen={isCloseShiftOpen}
                onClose={() => setIsCloseShiftOpen(false)}
            />
        </div>
    );
};

export default MainLayout;
