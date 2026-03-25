import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStoreCart } from '../contexts/StoreCartContext';
import StoreStickyCart from '../components/store/StoreStickyCart';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Search, ShoppingBag, Plus, Clock, HelpCircle } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import './Storefront.css';

const CATEGORY_LIST = [
    { id: 'แอลกอฮอร์และบุหรี่', label: 'แอลกอฮอร์และบุหรี่', icon: '🍺' },
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

    const [storeProducts, setStoreProducts] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedCategory, setSelectedCategory] = useState('Recommended');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [latestStatus, setLatestStatus] = useState(null);
    const [showToast, setShowToast] = useState(false);

    const fetchProducts = async (isNewSearch = false) => {
        setIsFetchingMore(true);
        const currentPage = isNewSearch ? 0 : page;
        
        let query = supabase
            .from('products')
            .select('*')
            .eq('showInStore', true);

        if (selectedCategory === 'Recommended' && !debouncedSearchTerm) {
            query = query.eq('isRecommended', true);
        } else if (selectedCategory !== 'Recommended' && !debouncedSearchTerm) {
            query = query.eq('category', selectedCategory);
        }

        if (debouncedSearchTerm) {
            query = query.ilike('name', `%${debouncedSearchTerm}%`);
        }

        query = query
            .order('posIndex', { ascending: true })
            .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

        const { data, error } = await query;

        if (error) {
            console.error("Supabase error:", error);
        } else {
            if (data.length < PAGE_SIZE) setHasMore(false);
            else setHasMore(true);
            
            setStoreProducts(prev => isNewSearch ? data : [...prev, ...data]);
            setPage(currentPage + 1);
        }
        setIsFetchingMore(false);
    };

    useEffect(() => {
        fetchProducts(true);
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
                <div className="store-hero">
                    <div className="hero-top">
                        <h1 className="store-title">Minimart <span>Delivery</span></h1>
                        <button className="help-trigger" onClick={() => setShowHelpModal(true)}>
                            <HelpCircle size={18} /> วิธีสั่งซื้อ
                        </button>
                    </div>
                    <div className="store-search-wrapper">
                        <Search size={20} />
                        <input 
                            type="text" 
                            placeholder="ค้นหาสินค้า..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="promo-section">
                    <div className="promo-card">
                        <img src="/promo_delivery_200.png" alt="Delivery 200 Min" />
                    </div>
                </div>

                {latestStatus && (
                    <div className="order-status-banner" onClick={() => navigate('/track')}>
                        <Clock size={16} />
                        <span>สถานะออเดอร์ล่าสุด: <strong>{latestStatus}</strong></span>
                    </div>
                )}

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
                {storeProducts.map(product => (
                    <StoreProductCard 
                        key={product.id} 
                        product={product} 
                        onAdd={() => handleAddToCart(product)}
                        currentQty={cart.find(item => item.id === product.id)?.quantity || 0}
                    />
                ))}
            </div>

            {hasMore && (
                <button className="load-more" onClick={() => fetchProducts()} disabled={isFetchingMore}>
                    {isFetchingMore ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
                </button>
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
                    <img src={product.image} alt={product.name} loading="lazy" />
                ) : (
                    <div className="no-image"><ShoppingBag size={40} /></div>
                )}
                {isOutOfStock && <div className="badge-out">หมด</div>}
            </div>
            <div className="product-info">
                <h3>{product.name}</h3>
                <div className="product-footer">
                    <span className="price">฿{product.price}</span>
                    <button 
                        className="add-btn" 
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

export default Storefront;
