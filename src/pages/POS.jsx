import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useProduct } from '../contexts/ProductContext';
import { useCart } from '../contexts/CartContext';
import { useShift } from '../contexts/ShiftContext';
import { useLanguage } from '../contexts/LanguageContext';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import PaymentModal from '../components/pos/PaymentModal';
import ParkedBillsModal from '../components/pos/ParkedBillsModal';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Clock, Bell, Monitor, Star, Grid, List as ListIcon, RefreshCw } from '../components/common/Icons';
import { useOrder } from '../contexts/OrderContext';
import QuickAddProductModal from '../components/pos/QuickAddProductModal';
import ProductCard from '../components/pos/ProductCard'; 
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useDebounce } from '../hooks/useDebounce';
import { playBeep, playError, playClick } from '../utils/sound';
import './POS.css';

const POS = () => {
    const { products, productMap, addProduct, updateProductOrder, getProductByBarcode, updateProduct, loading, connectionStatus } = useProduct();
    const { t } = useLanguage();
    const {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        total,
        parkCurrentCart,
        parkedCarts,
        deleteParkedCart,
        resumeParkedCart
    } = useCart();
    const { newOrderAlert, acknowledgeNewOrder } = useOrder();
    const { isShiftOpen, openShift } = useShift();

    // Local state for search
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [activeCategory, setActiveCategory] = useState('All');
    const [viewMode, setViewMode] = useState('grid');
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [localOrderedProducts, setLocalOrderedProducts] = useState([]);
    const [draggedProduct, setDraggedProduct] = useState(null);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isParkedBillsOpen, setIsParkedBillsOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState('');
    
    const isScanningRef = useRef(false);
    const searchInputRef = useRef(null);

    // Optimized filtering and sorting
    const filteredProducts = useMemo(() => {
        if (!products) return [];
        
        // Final Filtered List
        let result = products.filter(p => !p.isHero && (p.showInPOS === true || p.showInPOS === undefined));

        // Search Filter
        if (debouncedSearchTerm) {
            const search = debouncedSearchTerm.toLowerCase();
            result = result.filter(p => 
                (p.name || '').toLowerCase().includes(search) || 
                (p.barcode || '').toLowerCase().includes(search) ||
                (p.category || '').toLowerCase().includes(search)
            );
        }

        // Category Filter
        if (activeCategory !== 'All') {
            result = result.filter(p => p.category === activeCategory);
        }

        // Apply Sorting (only if not searching, or keep order for category)
        result.sort((a, b) => {
            const indexA = typeof a.posIndex === 'number' ? a.posIndex : 999999;
            const indexB = typeof b.posIndex === 'number' ? b.posIndex : 999999;
            if (indexA !== indexB) return indexA - indexB;
            return (a.name || '').localeCompare(b.name || '');
        });

        return result;
    }, [products, debouncedSearchTerm, activeCategory]);

    useEffect(() => {
        if (isReorderMode) {
            setLocalOrderedProducts(filteredProducts);
        }
    }, [isReorderMode, filteredProducts]);

    const handleDragStart = useCallback((e, product) => {
        setDraggedProduct(product);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e, targetProduct) => {
        e.preventDefault();
        if (!draggedProduct || draggedProduct.id === targetProduct.id) return;

        setLocalOrderedProducts(prev => {
            const newList = [...prev];
            const fromIndex = newList.findIndex(p => p.id === draggedProduct.id);
            const toIndex = newList.findIndex(p => p.id === targetProduct.id);

            if (fromIndex !== -1 && toIndex !== -1) {
                const [movedItem] = newList.splice(fromIndex, 1);
                newList.splice(toIndex, 0, movedItem);
            }
            return newList;
        });
        setDraggedProduct(null);
    }, [draggedProduct]);

    const handleProductClick = useCallback((product) => {
        playClick();
        if (!isReorderMode) {
            addToCart(product);
        }
    }, [isReorderMode, addToCart]);

    const saveReorder = async () => {
        try {
            const updates = localOrderedProducts.map((p, index) => ({
                id: p.id,
                name: p.name,
                posIndex: index
            }));
            await updateProductOrder(updates);
            alert("บันทึกตำแหน่งสินค้าเรียบร้อยแล้วครับ! ✨");
            setIsReorderMode(false);
        } catch (error) {
            console.error("Save reorder error:", error);
            alert("บันทึกไม่สำเร็จ: " + (error.message || "เกิดข้อผิดพลาดทางเทคนิค"));
        }
    };

    const handleHideProduct = useCallback(async (product, e) => {
        if (e) e.stopPropagation();
        if (window.confirm(`นำ "${product.name}" ออกจากหน้าต่างคิดเงิน?\n(สามารถเปิดแสดงใหม่ได้ที่เมนู "จัดการสินค้า")`)) {
            try {
                // อัปเดตข้อมูลเพื่อให้หายไปจาก POS 
                await updateProduct(product.id, { showInPOS: false });
                
                // สำหรับให้หายเดี๋ยวนี้ทันทีในโหมดการจัดเรียง
                if (isReorderMode) {
                    setLocalOrderedProducts(prev => prev.filter(p => p.id !== product.id));
                }
            } catch (error) {
                console.error("Failed to hide product:", error);
                alert("เกิดข้อผิดพลาดในการซ่อนสินค้า");
            }
        }
    }, [updateProduct, isReorderMode]);

    const handleScan = useCallback((code) => {
        if (isScanningRef.current) return;
        if (isPaymentOpen || isParkedBillsOpen) return;

        isScanningRef.current = true;
        setTimeout(() => isScanningRef.current = false, 50); 

        try {
            const result = getProductByBarcode(code);
            if (result) {
                playBeep();
                setIsQuickAddOpen(false);
                addToCart(result.product, result.type === 'unit' ? 1 : (result.type === 'pack' ? 'pack' : 'case'));
                setSearchTerm('');
            } else {
                playError();
                setScannedBarcode(code);
                setIsQuickAddOpen(true);
            }
        } catch (err) {
            console.error("Scan error:", err);
            playError();
        }
    }, [getProductByBarcode, isPaymentOpen, isParkedBillsOpen, addToCart]);

    // Initialize Scanner Hook
    useBarcodeScanner(handleScan);

    // Keep manual search for fallback
    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm) {
            handleScan(searchTerm);
        }
    };

    const handleQuickAddConfirm = async (productData) => {
        // 1. Add to database
        try {
            const newProduct = await addProduct({
                ...productData,
                stock: 100, // Default generous stock
                minStock: 5,
                unit: 'ชิ้น', // Default unit
                showInPOS: true
            });

            // 2. Add to cart immediately
            if (newProduct) {
                addToCart(newProduct);
                setSearchTerm('');
            }
        } catch (error) {
            console.error("Failed to quick add product:", error);
            alert(t('error'));
        }
    };

    const [displayLimit, setDisplayLimit] = useState(120);
    const displayedProducts = filteredProducts.slice(0, displayLimit);

    const styles = React.useMemo(() => ({
        container: {
            display: 'flex',
            // Calculate height to fit: 100vh - header(64px)
            // But since we are inside a padded wrapper, we use 100% of parent usually, 
            // but parent scrolls.
            // Let's force full viewport height minus header, and remove wrapper padding effect with negative margin
            height: 'calc(100vh - 64px)',
            margin: '-2rem', // Counteract MainLayout padding
            overflow: 'hidden',
            gap: '1rem',
            padding: '1rem',
            background: '#f8fafc',
            boxSizing: 'border-box'
        },
        productsPanel: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: 'white',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            minHeight: 0
        },
        categoryTabs: {
            display: 'flex',
            gap: '0.5rem',
            paddingBottom: '0.5rem'
        },
        categoryTab: {
            padding: '0.75rem 1.5rem',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            background: 'white',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
        },
        categoryTabActive: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderColor: '#667eea',
            color: 'white'
        },
        productGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.75rem',
            overflowY: 'auto',
            flex: 1,
            alignContent: 'start'
        },
        productCard: {
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content'
        },
        productImage: {
            width: '100%',
            height: '100px',
            objectFit: 'cover',
            borderRadius: '6px',
            marginBottom: '0.5rem'
        },
        productName: {
            fontSize: '1.25rem', // Larger name
            fontWeight: '600',
            marginBottom: '0.4rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            lineHeight: '1.3'
        },
        productPrice: {
            fontSize: '1.5rem', // Larger price
            fontWeight: '800',
            color: '#667eea',
            marginBottom: '0.2rem'
        },
        // Stock removed as requested
        cartPanel: {
            width: '550px',
            display: 'flex',
            flexDirection: 'column',
            background: 'white',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            minHeight: 0
        },
        cartHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '1rem',
            borderBottom: '1px solid #e5e7eb',
            marginBottom: '1rem'
        },
        cartTitle: {
            fontSize: '1.5rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        },
        cartItems: {
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minHeight: 0,
            marginBottom: '1rem'
        },
        cartItem: {
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem',
            background: '#f9fafb',
            borderRadius: '16px',
            border: '1px solid #e5e7eb'
        },
        itemInfo: {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
        },
        itemName: {
            fontWeight: '700',
            fontSize: '1.35rem',
            color: '#1f2937',
            marginBottom: '0.1rem',
            lineHeight: '1.3'
        },
        itemPrice: {
            fontSize: '1.15rem',
            color: '#6b7280',
            fontWeight: '500'
        },
        itemControls: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'white',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
        },
        quantityDisplay: {
            minWidth: '40px',
            textAlign: 'center',
            fontWeight: '700',
            fontSize: '1.5rem',
            color: '#374151'
        },
        itemTotal: {
            fontWeight: '800',
            fontSize: '1.5rem',
            color: '#667eea',
            minWidth: '80px',
            textAlign: 'right'
        },
        cartFooter: {
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flexShrink: 0
        },
        totalSection: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1.5rem',
            borderRadius: '12px',
            color: 'white'
        },
        totalLabel: {
            fontSize: '1.1rem',
            opacity: 0.9,
            marginBottom: '0.5rem'
        },
        totalAmount: {
            fontSize: '3.5rem',
            fontWeight: '800',
            margin: 0
        },
        emptyCart: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            textAlign: 'center',
            gap: '1rem' // Add gap to prevent overlap
        },
        shiftWarning: {
            padding: '3rem',
            textAlign: 'center',
            background: 'white',
            borderRadius: '16px',
            margin: '2rem'
        }
    }), []);

    if (!isShiftOpen) {
        return (
            <div style={{
                height: 'calc(100vh - 84px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent'
            }}>
                <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '24px',
                    boxShadow: 'var(--shadow-xl)',
                    maxWidth: '450px',
                    width: '100%',
                    border: '1px solid rgba(255,255,255,0.5)'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#fee2e2',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        color: '#ef4444'
                    }}>
                        <Clock size={40} />
                    </div>

                    <h2 style={{
                        fontSize: '1.75rem',
                        marginBottom: '0.5rem',
                        color: 'var(--text-main)',
                        fontWeight: '800'
                    }}>
                        {t('shiftClosed')}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        เริ่มต้นกะใหม่เพื่อเริ่มทำการขายและบันทึกยอดขาย
                    </p>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        background: 'var(--bg-main)',
                        padding: '1.5rem',
                        borderRadius: '16px',
                        marginBottom: '1.5rem',
                        border: '1px solid var(--border)'
                    }}>
                        <label style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            fontWeight: '500',
                            alignSelf: 'flex-start'
                        }}>
                            {t('startCash')}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                defaultValue={1000}
                                id="start-cash-input"
                                className="input-field"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    paddingRight: '3rem',
                                    fontSize: '1.25rem',
                                    fontWeight: '700',
                                    textAlign: 'right',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                            />
                            <span style={{
                                position: 'absolute',
                                right: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                fontWeight: '500'
                            }}>฿</span>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                            const cash = document.getElementById('start-cash-input').value;
                            openShift(cash);
                        }}
                    >
                        {t('startShift')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Products Panel */}
            <div style={styles.productsPanel}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Title & Alert */}
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginRight: 'auto' }}>
                        {t('products')} ({products.length})
                    </h2>
                    {newOrderAlert && (
                        <button
                            onClick={acknowledgeNewOrder}
                            style={{
                                background: '#ef4444', color: 'white', border: 'none',
                                padding: '6px 12px', borderRadius: '99px',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                cursor: 'pointer', animation: 'pulse 1s infinite', fontSize: '0.9rem', fontWeight: 600
                            }}
                        >
                            <Bell size={16} /> {t('newOrder')}!
                        </button>
                    )}
                    <Input
                        placeholder={t('searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        icon={Search}
                        containerStyle={{ flex: 1 }}
                    />
                    <div className="status-indicator-badges">
                        {connectionStatus === 'syncing' ? (
                            <div className="badge badge-syncing">
                                <RefreshCw size={14} className="spin" /> {t('syncing') || 'Syncing...'}
                            </div>
                        ) : connectionStatus === 'cached' ? (
                             <div className="badge badge-cached">
                                <RefreshCw size={14} /> {t('offline') || 'Cached Mode'}
                            </div>
                        ) : (
                             <div className="badge badge-connected">
                                <div className="dot" /> {t('connected') || 'Live'}
                            </div>
                        )}
                        {loading && <Loader2 size={16} className="spin text-primary" />}
                    </div>

                    {!isReorderMode ? (
                        <Button variant="outline" onClick={() => setIsReorderMode(true)}>
                            {t('reorderMode')}
                        </Button>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                                onClick={saveReorder}
                                style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }}
                            >
                                {t('save')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsReorderMode(false);
                                    setReorderSelection(null);
                                }}
                                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            >
                                {t('cancel')}
                            </Button>
                        </div>
                    )}
                </div>



                <div style={styles.productGrid}>
                    {displayedProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            isSelected={reorderSelection?.id === product.id || draggedProduct?.id === product.id}
                            isReorderMode={isReorderMode}
                            onClick={handleProductClick}
                            onHide={handleHideProduct}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            styles={styles}
                            className={!isReorderMode ? "product-card-hover" : ""}
                        />
                    ))}
                    {filteredProducts.length > displayedProducts.length && (
                        <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center' }}>
                            <Button
                                variant="outline"
                                onClick={() => setDisplayLimit(prev => prev + 120)}
                                style={{ width: '200px' }}
                            >
                                โหลดสินค้าเพิ่ม...
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Panel */}
            <div style={styles.cartPanel}>
                <div style={styles.cartHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={styles.cartTitle}>
                            <ShoppingCart size={24} />
                            {t('cart')} ({cart.length})
                        </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {parkedCarts.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsParkedBillsOpen(true)}
                                style={{ color: '#f59e0b', display: 'flex', gap: '4px', border: '1px solid #fcd34d' }}
                                title={t('viewParkedBills')}
                            >
                                <Clock size={16} />
                                <span>{parkedCarts.length}</span>
                            </Button>
                        )}
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} title={t('clearCart')}>
                                <Trash2 size={16} />
                            </Button>
                        )}
                    </div>
                </div>

                <div style={styles.cartItems}>
                    {cart.length === 0 ? (
                        <div style={styles.emptyCart}>
                            <ShoppingCart size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{t('emptyCart')}</p>
                            <small>{t('clickToAdd')}</small>
                            {parkedCarts.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsParkedBillsOpen(true)}
                                    style={{ marginTop: '1rem', color: '#f59e0b', borderColor: '#f59e0b' }}
                                >
                                    <Clock size={16} style={{ marginRight: '4px' }} />
                                    เรียกคืนบิล ({parkedCarts.length})
                                </Button>
                            )}
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} style={styles.cartItem}>
                                <div style={styles.itemInfo}>
                                    <h4 style={styles.itemName}>{item.name}</h4>
                                    <p style={styles.itemPrice}>฿{item.price} x {item.quantity}</p>
                                </div>
                                <div style={styles.itemControls}>
                                    <Button
                                        variant="ghost"
                                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                        style={{ height: '40px', width: '40px', padding: 0 }}
                                    >
                                        <Minus size={20} />
                                    </Button>
                                    <span style={styles.quantityDisplay}>{item.quantity}</span>
                                    <Button
                                        variant="ghost"
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        style={{ height: '40px', width: '40px', padding: 0 }}
                                    >
                                        <Plus size={20} />
                                    </Button>
                                    <div style={{ width: '1px', height: '24px', background: '#e5e7eb', margin: '0 4px' }} />
                                    <Button
                                        variant="ghost"
                                        onClick={() => removeFromCart(item.id)}
                                        style={{ color: '#ef4444', height: '40px', width: '40px', padding: 0 }}
                                    >
                                        <Trash2 size={20} />
                                    </Button>
                                </div>
                                <div style={styles.itemTotal}>
                                    ฿{(item.price * item.quantity).toFixed(2)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={styles.cartFooter}>
                    <div style={styles.totalSection}>
                        <div style={styles.totalLabel}>{t('total')}</div>
                        <h2 style={styles.totalAmount}>฿{total.toFixed(2)}</h2>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button
                            disabled={cart.length === 0}
                            onClick={() => {
                                if (window.confirm(t('confirmParkBill'))) {
                                    parkCurrentCart();
                                }
                            }}
                            style={{
                                flex: 1,
                                height: '80px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '1rem',
                                fontWeight: '700',
                                background: cart.length === 0 ? '#f3f4f6' : '#fff7ed',
                                border: cart.length === 0 ? 'none' : '2px solid #fdba74',
                                color: cart.length === 0 ? '#9ca3af' : '#ea580c',
                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                borderRadius: '12px'
                            }}
                            title={t('parkBill')}
                        >
                            <Clock size={24} />
                            <span>พักบิล</span>
                        </Button>

                        <Button
                            disabled={cart.length === 0}
                            onClick={() => setIsPaymentOpen(true)}
                            style={{
                                flex: 3,
                                height: '80px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                background: cart.length === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                color: cart.length === 0 ? '#9ca3af' : 'white',
                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                borderRadius: '12px'
                            }}
                        >
                            <CreditCard size={32} /> ชำระเงิน
                        </Button>
                    </div>
                </div>
            </div>

            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
            />

            <QuickAddProductModal
                key={scannedBarcode}
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                barcode={scannedBarcode}
                onConfirm={handleQuickAddConfirm}
            />

            <ParkedBillsModal
                isOpen={isParkedBillsOpen}
                onClose={() => setIsParkedBillsOpen(false)}
                parkedCarts={parkedCarts}
                onResume={resumeParkedCart}
                onDelete={deleteParkedCart}
            />
        </div>
    );
};

export default POS;
