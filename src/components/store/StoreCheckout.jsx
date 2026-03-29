import React, { useState } from 'react';
import { useStoreCart } from '../../contexts/StoreCartContext';
import { useOrder } from '../../contexts/OrderContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Upload, CreditCard, Banknote, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { QRCodeSVG } from 'qrcode.react';
import { updateQrAmount } from '../../services/emvqr';
import MapPicker from './MapPicker';
import './StoreCheckout.css';

const STATIC_QR = "00020101021130650016A000000677010112011501075360001028602150140000047446780303SCB5802TH530376462200716000000000068782963040ACD";

const StoreCheckout = () => {
    const navigate = useNavigate();
    const { cart, totalPrice, clearCart } = useStoreCart();
    const { createOrder } = useOrder();

    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        memo: '',
        location: null // { lat, lng }
    });

    // Load saved info
    React.useEffect(() => {
        const savedInfo = localStorage.getItem('customer_info');
        if (savedInfo) {
            try {
                const parsed = JSON.parse(savedInfo);
                setForm(prev => ({
                    ...prev,
                    name: parsed.name || '',
                    phone: parsed.phone || '',
                    address: parsed.address || '',
                    memo: parsed.memo || '',
                    location: parsed.location || null
                }));
            } catch (e) {
                console.error("Error parsing saved customer info", e);
            }
        }
    }, []);
    const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' or 'transfer'
    const [slipFile, setSlipFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deliveryTime, setDeliveryTime] = useState('17:00');
    const [isMapOpen, setIsMapOpen] = useState(false);

    const [isCheckingSlip, setIsCheckingSlip] = useState(false);
    const [slipAmountMatched, setSlipAmountMatched] = useState(null);
    const [slipCheckMessage, setSlipCheckMessage] = useState('');

    // Check if cart has water packs
    const hasWaterPack = cart.some(item => item.name.includes('น้ำแพ็ค'));

    // 1. Open Map Picker
    const handleOpenMap = () => {
        setIsMapOpen(true);
    };

    const handleConfirmLocation = (pos) => {
        setForm(prev => ({ ...prev, location: pos }));
        setIsMapOpen(false);
    };

    // 2. Handle File Upload
    const handleFileChange = async (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setSlipFile(file);
            
            // Reset states
            setSlipAmountMatched(null);
            setSlipCheckMessage('กำลังตรวจสอบยอดเงินในสลิป...');
            setIsCheckingSlip(true);

            try {
                const imageUrl = URL.createObjectURL(file);
                // Perform OCR
                const result = await Tesseract.recognize(imageUrl, 'tha+eng');
                const text = result.data.text;
                URL.revokeObjectURL(imageUrl);
                
                // Try number formats matching totalPrice
                const targetAmount = totalPrice.toString();
                const targetAmountWithDecimal = `${totalPrice}.00`;
                const targetAmountComma = totalPrice.toLocaleString();
                const targetAmountCommaDecimal = `${totalPrice.toLocaleString()}.00`;

                if (
                    text.includes(targetAmount) ||
                    text.includes(targetAmountWithDecimal) ||
                    text.includes(targetAmountComma) ||
                    text.includes(targetAmountCommaDecimal)
                ) {
                    setSlipAmountMatched(true);
                    setSlipCheckMessage('ยอดเงินตรงกัน สามารถยืนยันการสั่งซื้อได้');
                } else {
                    setSlipAmountMatched(false);
                    setSlipCheckMessage(`ไม่พบยอดเงิน ฿${totalPrice.toLocaleString()} ในสลิป กรุณาตรวจสอบอีกครั้ง`);
                }
            } catch (error) {
                console.error("OCR Error:", error);
                setSlipAmountMatched(false);
                setSlipCheckMessage('ไม่สามารถตรวจสอบสลิปได้ โปรดตรวจดูอีกครั้ง');
            } finally {
                setIsCheckingSlip(false);
            }
        }
    };

    // 3. Submit Order
    const handleSubmit = async () => {
        if (totalPrice < 200) {
            alert("ยอดสั่งซื้อขั้นต่ำคือ 200.- กรุณาเลือกสินค้าเพิ่มเติม");
            return;
        }

        if (!form.name || !form.phone || !form.address) {
            alert("กรุณากรอกข้อมูลจัดส่งให้ครบถ้วน");
            return;
        }

        if (hasWaterPack && !deliveryTime) {
            alert("กรุณาเลือกเวลาจัดส่งสำหรับน้ำดื่ม");
            return;
        }

        if (paymentMethod === 'transfer') {
            if (!slipFile) {
                alert("กรุณาแนบสลิปโอนเงิน");
                return;
            }
            if (isCheckingSlip) {
                alert("กำลังตรวจสอบสลิป กรุณารอสักครู่");
                return;
            }
            if (slipAmountMatched === false) {
                const proceed = window.confirm("ยอดเงินในสลิปไม่สามารถยืนยันได้หรืออาจจะไม่ตรงกับยอดสั่งซื้อ (OCR) ต้องการดำเนินการต่อหรือไม่?");
                if (!proceed) return;
            }
        }

        setIsSubmitting(true);

        try {
            // Rate Limit Check (Cooldown 3 minutes)
            const lastOrderTime = localStorage.getItem('last_order_time');
            if (lastOrderTime) {
                const diff = Date.now() - parseInt(lastOrderTime);
                const cooldown = 3 * 60 * 1000; // 3 minutes
                if (diff < cooldown) {
                    const minutesLeft = Math.ceil((cooldown - diff) / 60000);
                    alert(`กรุณารออีก ${minutesLeft} นาที ก่อนสั่งซื้อครั้งถัดไป`);
                    setIsSubmitting(false); // Reset loading state
                    return;
                }
            }

            const { supabase } = await import('../../services/supabase');

            let slipUrl = null;
            if (slipFile) {
                const fileExt = slipFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `slips/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('slips')
                    .upload(filePath, slipFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('slips')
                    .getPublicUrl(filePath);
                    
                slipUrl = publicUrl;
            }

            const orderData = {
                customer: {
                    name: form.name,
                    phone: form.phone,
                    address: form.address,
                    location: form.location,
                    memo: form.memo
                },
                deliveryTime: hasWaterPack ? deliveryTime : null,
                items: cart,
                total: totalPrice,
                paymentMethod,
                slipUrl,
                status: 'pending',
                date: new Date().toISOString(),
                type: 'store'
            };

            const newOrder = await createOrder(orderData);

            // Set cooldown timestamp
            localStorage.setItem('last_order_time', Date.now().toString());

            // Save info to local storage for next time
            localStorage.setItem('customer_info', JSON.stringify({
                name: form.name,
                phone: form.phone,
                address: form.address,
                location: form.location,
                memo: form.memo
            }));

            // Save order to history
            const orderHistory = JSON.parse(localStorage.getItem('store_order_history') || '[]');
            const newHistoryItem = {
                id: newOrder.id,
                date: new Date().toISOString(),
                total: totalPrice
            };
            // Keep only last 10 orders
            const updatedHistory = [newHistoryItem, ...orderHistory].slice(0, 10);
            localStorage.setItem('my_orders', JSON.stringify(updatedHistory));

            clearCart();
            navigate(`/store/tracking/${newOrder.id}`);
        } catch (error) {
            console.error("Order error:", error);
            const errMsg = error?.message || "ไม่ทราบสาเหตุ";
            
            // Helpful messages for common errors
            if (errMsg.includes('bucket') || errMsg.includes('storage')) {
                alert(`เกิดข้อผิดพลาดในการอัปโหลดสลิป: ${errMsg}\n(แอดมิน: กรุณาตรวจสอบว่ามี Bucket "slips" ใน Supabase Storage และตั้งค่า Public / RLS แล้วหรือยัง)`);
            } else {
                alert(`เกิดข้อผิดพลาดในการสั่งซื้อ: ${errMsg}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (cart.length === 0) {
        return (
            <div className="checkout-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                <p>ตะกร้าว่างเปล่า</p>
                <button onClick={() => navigate('/store')} style={{ marginTop: '1rem', color: '#3b82f6' }}>กลับไปเลือกสินค้า</button>
            </div>
        );
    }

    return (
        <div className="checkout-container">
            <header className="checkout-header">
                <button className="back-btn" onClick={() => navigate('/store')}>
                    <ChevronLeft size={24} />
                </button>
                <div className="checkout-title">ยืนยันการสั่งซื้อ</div>
            </header>

            {/* Address Section */}
            <section className="checkout-section">
                <div className="section-title">
                    <MapPin size={18} /> ข้อมูลจัดส่ง
                </div>
                <div className="form-group">
                    <label className="form-label">ชื่อผู้รับ</label>
                    <input
                        className="form-input"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="ชื่อ-นามสกุล"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">เบอร์โทรศัพท์</label>
                    <input
                        className="form-input"
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="08x-xxx-xxxx"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">ที่อยู่จัดส่ง</label>
                    <textarea
                        className="form-textarea"
                        rows={3}
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        placeholder="บ้านเลขที่, ซอย"
                    />
                </div>
                <button className="location-btn" onClick={handleOpenMap}>
                    <MapPin size={16} />
                    {form.location ? `ปักหมุดแล้ว (${form.location.lat.toFixed(4)}, ${form.location.lng.toFixed(4)})` : 'คลิกเพื่อปักหมุดตำแหน่งที่อยู่'}
                </button>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">รายละเอียดเพิ่มเติม (Memo)</label>
                    <input
                        className="form-input"
                        value={form.memo}
                        onChange={e => setForm({ ...form, memo: e.target.value })}
                        placeholder="เช่น ฝากไว้ที่ป้อมยาม, บ้านสีฟ้า"
                    />
                </div>
            </section>

            {/* Delivery Time Section (Conditional) */}
            {hasWaterPack && (
                <section className="checkout-section">
                    <div className="section-title">
                        <Clock size={18} /> รอบเวลาจัดส่งน้ำดื่ม
                    </div>
                    <div className="payment-options delivery-grid">
                        {['17:00'].map(time => (
                            <div
                                key={time}
                                className={`payment-card ${deliveryTime === time ? 'active' : ''}`}
                                onClick={() => setDeliveryTime(time)}
                            >
                                <div style={{ fontWeight: 'bold' }}>{time}</div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Payment Section */}
            <section className="checkout-section">
                <div className="section-title">
                    <CreditCard size={18} /> วิธีชำระเงิน
                </div>
                <div className="payment-options">
                    <div
                        className={`payment-card ${paymentMethod === 'cod' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('cod')}
                    >
                        <Banknote size={24} style={{ marginBottom: '0.5rem' }} />
                        <div>เก็บเงินปลายทาง</div>
                    </div>
                    <div
                        className={`payment-card ${paymentMethod === 'transfer' ? 'active' : ''}`}
                        onClick={() => setPaymentMethod('transfer')}
                    >
                        <CreditCard size={24} style={{ marginBottom: '0.5rem' }} />
                        <div>โอนเงิน</div>
                    </div>
                </div>

                {paymentMethod === 'transfer' && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>สแกนเพื่อจ่ายเงิน</p>
                            <div style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px', marginBottom: '8px' }}>
                                <QRCodeSVG value={updateQrAmount(STATIC_QR, totalPrice)} size={200} />
                            </div>
                            <p><strong>ยอดชำระ: ฿{totalPrice.toLocaleString()}</strong></p>
                            <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>ธนาคารกสิกรไทย / ร้านมินิมาร์ท</p>
                        </div>
                        <div className="upload-box" style={{ position: 'relative' }}>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                disabled={isCheckingSlip}
                            />
                            {isCheckingSlip ? (
                                <Loader className="animate-spin" size={24} style={{ marginBottom: '0.5rem', color: '#3b82f6' }} />
                            ) : (
                                <Upload size={24} style={{ marginBottom: '0.5rem' }} />
                            )}
                            <div>{slipFile ? slipFile.name : 'แตะเพื่ออัปโหลดสลิป'}</div>
                        </div>

                        {/* Slip Verification Feedback */}
                        {slipFile && slipCheckMessage && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                backgroundColor: isCheckingSlip ? '#f3f4f6' : (slipAmountMatched ? '#dcfce7' : '#fee2e2'),
                                color: isCheckingSlip ? '#4b5563' : (slipAmountMatched ? '#166534' : '#991b1b')
                            }}>
                                {isCheckingSlip && <Loader className="animate-spin" size={16} />}
                                {!isCheckingSlip && slipAmountMatched === true && <CheckCircle size={16} />}
                                {!isCheckingSlip && slipAmountMatched === false && <AlertCircle size={16} />}
                                <span>{slipCheckMessage}</span>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Summary Section */}
            <section className="checkout-section">
                <div className="section-title">สรุปรายการ</div>
                {cart.map(item => (
                    <div key={item.id} className="cart-summary-item">
                        <span>{item.quantity} x {item.name}</span>
                        <span>฿{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                ))}
                <div className="total-row">
                    <span>ยอดรวมสุทธิ</span>
                    <span>฿{totalPrice.toLocaleString()}</span>
                </div>
            </section>

            <div style={{ padding: '0 1rem' }}>
                <button
                    className="submit-btn"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'กำลังสั่งซื้อ...' : 'ยืนยันการสั่งซื้อ'}
                </button>
            </div>

            {isMapOpen && (
                <MapPicker
                    initialLocation={form.location}
                    onConfirm={handleConfirmLocation}
                    onCancel={() => setIsMapOpen(false)}
                />
            )}
        </div>
    );
};

export default StoreCheckout;
