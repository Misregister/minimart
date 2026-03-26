import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Copy, Code, GraduationCap, ShoppingCart, CreditCard, Banknote, Check, ArrowDown } from '../components/common/Icons';
import './CustomerDisplay.css';

const PROMO_SLIDES = [
    {
        id: "promo_water",
        type: "image",
        src: "/new.png",
        color: "blue",
        duration: 20000 // 20 seconds duration
    },
    {
        id: 1,
        title: "รับปริ้นงาน",
        subtitle: "เอกสาร • รูปภาพ • รายงาน",
        icon: Printer,
        color: "blue",
        tags: ["A4", "สี/ขาวดำ", "กระดาษโฟโต้"]
    },
    {
        id: 2,
        title: "บริการถ่ายเอกสาร",
        subtitle: "ชัดเจน รวดเร็ว ราคาประหยัด",
        icon: Copy,
        color: "amber",
        tags: ["ถ่ายบัตรประชาชน", "ย่อ/ขยาย", "เข้าเล่ม"]
    },
    {
        id: 3,
        title: "รับเขียนโปรแกรม",
        subtitle: "เว็บไซต์ & ระบบจัดการร้านค้า",
        icon: Code,
        color: "violet",
        tags: ["Web App", "POS System", "Landing Page"]
    },
    {
        id: 4,
        title: "สอนคอมพิวเตอร์",
        subtitle: "พื้นฐานสำหรับเด็ก",
        icon: GraduationCap,
        color: "emerald",
        tags: ["Microsoft Office", "การเงินพื้นฐาน", "ตัดต่อเบื้องต้น"]
    }
];

// Error Boundary for debugging
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("CustomerDisplay Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'red', background: 'white', height: '100vh', overflow: 'auto' }}>
                    <h1>Something went wrong.</h1>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

const CustomerDisplayContent = () => {
    const [state, setState] = useState({
        type: 'idle', // idle, cart, payment, success
        cart: [],
        total: 0,
        paymentMethod: null,
        qrPayload: null,
        change: 0,
        received: 0,
        customerName: null
    });

    const [activeSlide, setActiveSlide] = useState(0);

    // Auto-rotate slides
    useEffect(() => {
        const slideDuration = PROMO_SLIDES[activeSlide]?.duration || 6000;
        const timer = setTimeout(() => {
            setActiveSlide((prev) => (prev + 1) % PROMO_SLIDES.length);
        }, slideDuration);

        return () => clearTimeout(timer);
    }, [activeSlide]);

    // Listen for POS updates (Local BroadcastChannel + Storage backup)
    useEffect(() => {
        // Initial load from storage OR channel
        const loadInitial = () => {
            const storedCart = localStorage.getItem('pos_current_cart');
            const storedTotal = localStorage.getItem('pos_current_total') || 0;
            const storedLastPayment = localStorage.getItem('pos_last_payment');

            if (storedLastPayment) {
                const lp = JSON.parse(storedLastPayment);
                setState(prev => ({ 
                    ...prev, 
                    type: 'success', 
                    total: lp.total || 0,
                    change: lp.change || 0,
                    received: lp.received || 0,
                    cart: []
                }));
            } else if (storedCart) {
                const cart = JSON.parse(storedCart);
                if (Array.isArray(cart) && cart.length > 0) {
                    setState(prev => ({ 
                        ...prev, 
                        type: 'cart', 
                        cart, 
                        total: Number(storedTotal) || 0 
                    }));
                }
            }
        };

        loadInitial();

        // 1. BroadcastChannel (Local)
        const channel = new BroadcastChannel('pos_customer_display');
        channel.onmessage = (event) => {
            const data = event.data;
            if (data) {
                setState(prev => ({ ...prev, ...data, cart: data.cart || [] }));
            }
        };

        // 2. Storage Event (Cross-tab fallback)
        const handleStorage = (e) => {
            if (e.key === 'pos_current_cart' || e.key === 'pos_last_payment') {
                loadInitial();
            }
        };
        window.addEventListener('storage', handleStorage);

        return () => {
            channel.close();
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    // Helper to format currency
    const fmt = (num) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(num);

    const safeCart = state.cart || []; // Defensive check

    // RENDER: IDLE STATE (Screensaver)
    if (state.type === 'idle' || (safeCart.length === 0 && state.type !== 'success')) {
        const slide = PROMO_SLIDES[activeSlide];

        return (
            <div className={`cds-container theme-${slide.color}`}>
                <div className="cds-glass-layer">
                    {/* Animated Background Elements */}
                    <div className="orb orb-1"></div>
                    <div className="orb orb-2"></div>
                    <div className="orb orb-3"></div>

                    {/* Content */}
                    {slide.type === 'image' ? (
                        <div className="promo-image-container fade-enter">
                            <img src={slide.src} alt="Promotion" className="promo-full-image" />
                        </div>
                    ) : (
                        <div className="promo-content fade-enter">
                            <div className="promo-icon-box pulse">
                                {slide.icon && React.createElement(slide.icon, { size: 140, strokeWidth: 1.5 })}
                            </div>
                            <h1 className="promo-title">{slide.title}</h1>
                            <div className="promo-subtitle">{slide.subtitle}</div>

                            <div className="promo-tags">
                                {slide.tags?.map(tag => (
                                    <span key={tag} className="tag">{tag}</span>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Indicators */}
                    <div className="slide-indicators">
                        {PROMO_SLIDES.map((_, i) => (
                            <div key={i} className={`dot ${i === activeSlide ? 'active' : ''}`} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // RENDER: SUCCESS STATE
    if (state.type === 'success') {
        return (
            <div className="cds-container theme-success">
                <div className="cds-glass-layer center-content">
                    <div className="success-card scale-in">
                        <div className="success-icon-ring">
                            <Check size={120} strokeWidth={3} />
                        </div>
                        <h1>ชำระเงินสำเร็จ</h1>
                        <p>ขอบคุณที่ใช้บริการครับ</p>

                        {state.change > 0 && (
                            <div className="change-display">
                                <span>เงินทอน</span>
                                <div className="amount">{fmt(state.change)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // RENDER: ACTIVE / PAYMENT STATE
    return (
        <div className="cds-container theme-active">
            <div className="cds-split-layout">
                {/* LEFT: CART ITEMS (Identical) */}
                <div className="cds-left-panel glass-panel">
                    <div className="panel-header">
                        <ShoppingCart size={32} />
                        <h2>รายการสินค้า ({safeCart.length})</h2>
                    </div>
                    <div className="cart-list">
                        {safeCart.map((item, idx) => (
                            <div key={idx} className="cart-item">
                                <div className="item-info">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-detail">{item.quantity} x {fmt(item.price)}</span>
                                </div>
                                <div className="item-total">
                                    {fmt(item.price * item.quantity)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: TOTAL & PAYMENT */}
                <div className="cds-right-panel glass-panel">

                    {state.type === 'payment' ? (
                        // PAYMENT MODE
                        <div className="payment-mode fade-enter">
                            <div className="total-label">ยอดที่ต้องชำระ</div>
                            <div className="grand-total-lg">{fmt(state.total)}</div>

                            {/* QR CODE (Normal OR Split with Transfer) */}
                            {(state.paymentMethod === 'qrcode' || (state.paymentMethod === 'split' && state.qrPayload)) && state.qrPayload && (
                                <div className="qr-box">
                                    <div className="scan-instruction">
                                        <span className="scan-text-lg">สแกนตรงนี้</span>
                                        <ArrowDown size={48} className="bounce-arrow" />
                                    </div>
                                    <div className="qr-frame">
                                        <QRCodeSVG
                                            value={state.qrPayload}
                                            size={400}
                                            level="L"
                                            includeMargin
                                        />
                                    </div>
                                    <div className="promptpay-badge">
                                        PromptPay {state.paymentMethod === 'split' ? `(ยอดโอน ${fmt(state.splitDetails?.transfer || 0)})` : ''}
                                    </div>
                                </div>
                            )}

                            {/* CASH ONLY */}
                            {state.paymentMethod === 'cash' && (
                                <div className="cash-box">
                                    <div className="cash-row">
                                        <span>รับเงิน</span>
                                        <span className="cash-in">{fmt(state.received)}</span>
                                    </div>
                                    <div className="cash-row">
                                        <span>เงินทอน</span>
                                        <span className={`change ${state.received >= state.total ? 'positive' : ''}`}>
                                            {fmt(Math.max(0, state.received - state.total))}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* CREDIT */}
                            {state.paymentMethod === 'credit' && (
                                <div className="credit-box">
                                    <CreditCard size={80} />
                                    <p>กรุณายืนยันเครดิตสมาชิกลงบันทึก</p>
                                </div>
                            )}

                            {/* SPLIT Summary (if NO QR or just informative) */}
                            {state.paymentMethod === 'split' && !state.qrPayload && (
                                <div className="cash-box">
                                    <p>แยกจ่าย (เงินสด / โอน)</p>
                                    {/* Show details if needed, but usually QR takes precedence if exists */}
                                </div>
                            )}
                        </div>
                    ) : (
                        // VIEW CART MODE
                        <div className="summary-mode">
                            <div className="total-section">
                                <div className="total-label">ยอดรวมทั้งสิ้น</div>
                                <div className="grand-total">{fmt(state.total)}</div>
                            </div>
                            <div className="waiting-text">
                                <div className="dots-loading">
                                    <span></span><span></span><span></span>
                                </div>
                                กำลังทำรายการ...
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

const CustomerDisplay = () => (
    <ErrorBoundary>
        <CustomerDisplayContent />
    </ErrorBoundary>
);

export default CustomerDisplay;
