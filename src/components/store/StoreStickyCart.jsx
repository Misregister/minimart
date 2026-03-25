import React, { useState } from 'react';
import { useStoreCart } from '../../contexts/StoreCartContext';
import { ShoppingBag, X, Trash2, Plus, Minus, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StoreStickyCart = () => {
    const { totalItems, totalPrice, cart, updateQuantity, removeFromCart } = useStoreCart(); // cart, update, remove needed
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    if (totalItems === 0) return null;

    return (
        <>
            {/* 1. Floating Button (Always Visible) */}
            <div
                className="sticky-cart-btn"
                onClick={() => setIsOpen(true)}
            >
                <div style={{ position: 'relative' }}>
                    <ShoppingBag size={24} />
                    <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                    }}>
                        {totalItems}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>ตะกร้าสินค้า</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>฿{Number(totalPrice).toLocaleString()}</span>
                </div>
            </div>

            {/* 2. Cart Drawer (Popup) */}
            {isOpen && (
                <div className="cart-drawer-overlay" onClick={() => setIsOpen(false)}>
                    <div className="cart-drawer" onClick={e => e.stopPropagation()}>
                        <div className="cart-drawer-header">
                            <h3>ตะกร้าของฉัน ({totalItems})</h3>
                            <button className="close-drawer-btn" onClick={() => setIsOpen(false)}>
                                <ChevronDown size={24} />
                            </button>
                        </div>

                        <div className="cart-drawer-body">
                            {cart.map(item => (
                                <div key={item.id} className="cart-drawer-item">
                                    <div className="cart-item-info">
                                        <div className="cart-item-name">{item.name}</div>
                                        <div className="cart-item-price">฿{item.price}</div>
                                    </div>
                                    <div className="cart-item-controls">
                                        <button
                                            className="qty-btn"
                                            onClick={() => updateQuantity(item.id, -1)}
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span className="qty-value">{item.quantity}</span>
                                        <button
                                            className="qty-btn"
                                            onClick={() => updateQuantity(item.id, 1)}
                                            disabled={item.quantity >= (item.stock || 0) || item.quantity >= 50}
                                            style={{ opacity: (item.quantity >= (item.stock || 0) || item.quantity >= 50) ? 0.5 : 1 }}
                                        >
                                            <Plus size={16} />
                                        </button>
                                        <button
                                            className="remove-btn"
                                            onClick={() => removeFromCart(item.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="cart-drawer-footer">
                            <div className="total-row">
                                <span>ยอดรวมทั้งหมด</span>
                                <span>฿{Number(totalPrice).toLocaleString()}</span>
                            </div>
                            {totalPrice < 200 && (
                                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                                    ⚠️ ขั้นต่ำ 200 บาท เพื่อสั่งซื้อ
                                </div>
                            )}
                            <button
                                className="checkout-btn"
                                disabled={totalPrice < 200}
                                style={{ opacity: totalPrice < 200 ? 0.5 : 1, cursor: totalPrice < 200 ? 'not-allowed' : 'pointer' }}
                                onClick={() => {
                                    if (totalPrice < 200) return;
                                    setIsOpen(false);
                                    navigate('/store/checkout');
                                }}
                            >
                                สั่งซื้อสินค้า
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default StoreStickyCart;
