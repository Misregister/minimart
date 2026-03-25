import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStoreCart } from '../contexts/StoreCartContext';
import StoreStickyCart from '../components/store/StoreStickyCart';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Search, ShoppingBag, Plus, Clock, HelpCircle } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useProduct } from '../contexts/ProductContext';
import './Storefront.css';

const CATEGORY_LIST = [
    { id: 'แอลกอฮอร์และบุหรี่', label: 'แอลกอฮอล์และบุหรี่', icon: '🍺' },
    { id: 'ขนมและลูกอม', label: 'ขนมและลูกอม', icon: '🍬' },
    { id: 'เครื่องดื่ม', label: 'เครื่องดื่ม', icon: '🥤' },
    { id: 'นมและโยเกิร์ต', label: 'นมและโยเกิร์ต', icon: '🥛' },
    { id: 'สุขภาพและความงาม', label: 'สุขภาพและความงาม', icon: '💄' },
    { id: 'ของใช้ในครัวเรือน', label: 'ของใช้ในครัวเรือน', icon: '🏠' },
    { id: 'ครัวและเครื่องปรุงรส', label: 'ครัวและเครื่องปรุงรส', icon: '🍳' },
    { id: 'อาหารแห้ง', label: 'อาหารแห้ง', icon: '🍜' },
    { id: 'ของเล่นและเครื่องเขียน', label: 'ของเล่นและเครื่องเขียน', icon: '🧸' },
    { id: 'สัตว์เลี้ยง', label: 'สัตว์เลี้ยง', icon: '🐶' },
    { id: 'ยาสามัญประจำบ้าน', label: 'ยาสามัญประจำบ้าน', icon: '💊' },
    { id: 'ไอศกรีม', label: 'ไอศกรีม', icon: '🍦' },
    { id: 'อื่นๆ', label: 'อื่นๆ', icon: '📦' }
];

const PAGE_SIZE = 24;

const Storefront = () => {
    const navigate = useNavigate();
    const { addToCart, cart } = useStoreCart();
    const { products: allProducts, loading: ctxLoading } = useProduct();

    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedCategory, setSelectedCategory] = useState('Recommended');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [latestStatus, setLatestStatus] = useState(null);
    const [showToast, setShowToast] = useState(false);

    // INSTANT FILTERING FROM CONTEXT (PRE-LOADED DATA)
    const filteredProducts = useMemo(() => {
        let result = (allProducts || []).filter(p => p.showInStore);
        
        if (selectedCategory === 'Recommended' && !debouncedSearchTerm) {
            result = result.filter(p => p.isRecommended);
        } else if (selectedCategory !== 'Recommended' && !debouncedSearchTerm) {
            result = result.filter(p => p.category === selectedCategory);
        }

        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(term));
        }

        return result.sort((a, b) => (Number(a.posIndex) || 0) - (Number(b.posIndex) || 0));
    }, [allProducts, selectedCategory, debouncedSearchTerm]);

    const storeProducts = useMemo(() => {
        return filteredProducts.slice(0, page * PAGE_SIZE);
    }, [filteredProducts, page]);

    const hasMore = storeProducts.length < filteredProducts.length;

    useEffect(() => {
        setPage(1); // Reset page on filter change
    }, [selectedCategory, debouncedSearchTerm]);

    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('store_order_history') || '[]');
        if (history.length > 0) {
            const lastId = history[history.length - 1];
            supabase.from('orders').select('status').eq('id', lastId).single().then(({ data }) => {
                if (data) setLatestStatus(data.status);
            });

            const channel = supabase
                .channel(`order_track_${lastId}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${lastId}` }, (payload) => {
                    setLatestStatus(payload.new.status);
                })
                .subscribe();

            return () => supabase.removeChannel(channel);
        }
    }, []);

    // Infinite Scroll Observer
    const observer = React.useRef();
    const lastProductRef = useCallback(node => {
        if (ctxLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(p => p + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [ctxLoading, hasMore]);

    const handleAddToCart = useCallback((product) => {
        addToCart(product, 1);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    }, [addToCart]);

    return (
        <div className="store-container">
            {/* Help Modal */}
            {showHelpModal && (
                <div className="help-modal-overlay" onClick={() => setShowHelpModal(false)}>
                    <div className="help-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-help" onClick={() => setShowHelpModal(false)}>×</button>
                        <h2>🛍️ วิธีการสั่งซื้อ</h2>
                        <div className="help-steps">
                            <div className="step"><span>1</span><p>เลือกสินค้าที่ต้องการลงตะกร้า</p></div>
                            <div className="step"><span>2</span><p>ตรวจสอบยอดสั่งซื้อขั้นต่ำ 200.-</p></div>
                            <div className="step"><span>3</span><p>ระบุที่อยู่จัดส่งและเบอร์โทร</p></div>
                            <div className="step"><span>4</span><p>ชำระเงินและรอรับสินค้า</p></div>
                        </div>
                    </div>
                </div>
            )}

            {showToast && (
                <div className="store-toast">
                    <div className="toast-content">✅ เพิ่มสินค้าแล้ว</div>
                </div>
            )}

            <header className="store-header">
                <h1 className="store-title">Minimart Delivery</h1>
                
                <div className="store-search-wrapper">
                    <Search className="store-search-icon" size={18} />
                    <input 
                        type="text" 
                        className="store-search-input"
                        placeholder="วันนี้อยากทานอะไรดีครับ..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {latestStatus && (
                    <div className="active-order-banner" onClick={() => navigate(`/store/tracking/${JSON.parse(localStorage.getItem('store_order_history') || '[]').slice(-1)}`)}>
                        <Clock size={16} />
                        <div className="banner-content">
                            <span>สถานะออเดอร์ล่าสุด: <strong>{latestStatus}</strong></span>
                        </div>
                    </div>
                )}

                {/* Announcement Notice */}
                <div className="store-notice-card">
                    <div className="notice-image">
                        <img src="/media__1774473586344.png" alt="Oil Price Update" />
                    </div>
                    <div className="notice-content">
                        <h3>⚠️ แจ้งเปลี่ยนแปลงการจัดส่งน้ำดื่ม ⚠️</h3>
                        <p>เนื่องจากสถานการณ์ราคาน้ำมันไม่ปกติ ทางร้านขอปรับเงื่อนไขชั่วคราว:</p>
                        <div className="notice-badges">
                            <span className="notice-badge">✅ สั่งขั้นต่ำ 200.- ขึ้นไป</span>
                            <span className="notice-badge">✅ ปรับราคาตามต้นทุน</span>
                        </div>
                        <p className="notice-footer">ขอขอบพระคุณลูกค้าทุกท่านที่เข้าใจครับ/ค่ะ</p>
                    </div>
                </div>

                <div className="category-scroll-container">
                    <div className="category-scroll">
                        <button 
                            className={`category-pill ${selectedCategory === 'Recommended' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('Recommended')}
                        >
                            ⭐ แนะนำ
                        </button>
                        {CATEGORY_LIST.map(cat => (
                            <button 
                                key={cat.id}
                                className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="product-grid">
                {storeProducts.map((product, index) => {
                    const isLast = storeProducts.length === index + 1;
                    return (
                        <div key={product.id} ref={isLast ? lastProductRef : null}>
                            <StoreProductCard 
                                product={product} 
                                onAdd={() => handleAddToCart(product)}
                                currentQty={cart.find(item => item.id === product.id)?.quantity || 0}
                            />
                        </div>
                    );
                })}
                
                {ctxLoading && storeProducts.length === 0 && (
                    <>
                        <ProductSkeleton />
                        <ProductSkeleton />
                        <ProductSkeleton />
                        <ProductSkeleton />
                    </>
                )}
            </div>

            {!hasMore && storeProducts.length > 0 && (
                <div className="end-of-list">✨ สิ้นสุดรายการสินค้าแล้วครับ ✨</div>
            )}

            <StoreStickyCart />
        </div>
    );
};

const StoreProductCard = React.memo(({ product, onAdd, currentQty }) => {
    const isOutOfStock = (product.stock || 0) <= 0;
    return (
        <div className="product-card">
            <div className="product-image-frame">
                {product.image ? (
                    <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
                ) : (
                    <div className="no-image"><ShoppingBag size={40} /></div>
                )}
                {isOutOfStock && <div className="badge-out">หมด</div>}
                {product.isRecommended && <div className="product-badge badge-bestseller">ขายดี</div>}
            </div>
            <div className="product-info">
                <div className="product-name">{product.name}</div>
                <div className="product-unit">{product.unit || 'ชิ้น'}</div>
                <div className="product-footer">
                    <span className="product-price">฿{product.price}</span>
                    <button 
                        className={`add-btn ${isOutOfStock ? 'disabled' : ''}`}
                        onClick={onAdd}
                        disabled={isOutOfStock || currentQty >= 50}
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
});

const ProductSkeleton = () => (
    <div className="product-card skeleton">
        <div className="product-image-frame skeleton-pulse"></div>
        <div className="product-info">
            <div className="skeleton-line skeleton-pulse" style={{ width: '80%', height: '1.2rem' }}></div>
            <div className="skeleton-line skeleton-pulse" style={{ width: '40%', height: '0.8rem', marginTop: '0.5rem' }}></div>
            <div className="product-footer" style={{ marginTop: 'auto' }}>
                <div className="skeleton-line skeleton-pulse" style={{ width: '50%', height: '1.5rem' }}></div>
                <div className="add-btn skeleton-pulse" style={{ background: '#f1f5f9' }}></div>
            </div>
        </div>
    </div>
);

export default Storefront;
