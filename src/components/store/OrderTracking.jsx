import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Check, Clock, Package, Truck, Home } from 'lucide-react';
import './OrderTracking.css';

const STEPS = [
    { id: 'pending', label: 'รอร้านรับ', icon: Clock },
    { id: 'preparing', label: 'กำลังจัด', icon: Package },
    { id: 'shipping', label: 'กำลังส่ง', icon: Truck },
    { id: 'delivered', label: 'สำเร็จ', icon: Check }
];

const OrderTracking = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orderId) return;

        const fetchOrder = async () => {
            const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (data) setOrder(data);
            setLoading(false);
        };
        fetchOrder();

        const channel = supabase
            .channel(`order_${orderId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
                setOrder(payload.new);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [orderId]);

    const getCurrentStepIndex = (status) => {
        const index = STEPS.findIndex(s => s.id === status);
        return index === -1 ? 0 : index;
    };

    if (loading) return <div className="tracking-container">กำลังโหลดข้อมูล...</div>;
    if (!order) return <div className="tracking-container">ไม่พบคำสั่งซื้อ</div>;

    const currentStep = getCurrentStepIndex(order.status);

    return (
        <div className="tracking-container">
            <div className="tracking-card">
                <div className="order-id">Order ID: #{String(order.id).slice(0, 8)}</div>
                <div className="order-status-large">
                    {STEPS[currentStep]?.label || order.status}
                </div>

                <div className="status-steps">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index <= currentStep;
                        return (
                            <div key={step.id} className="status-step">
                                <div className={`step-circle ${isActive ? 'active' : ''}`}>
                                    <Icon size={16} />
                                </div>
                                <span className={`step-label ${isActive ? 'active' : ''}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="tracking-card">
                <h3 style={{ marginBottom: '1rem', textAlign: 'left' }}>ข้อมูลการจัดส่ง</h3>
                <div className="info-row">
                    <span className="info-label">ชื่อผู้รับ</span>
                    <span className="info-value">{order.customer?.name || order.customerName}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">ที่อยู่</span>
                    <span className="info-value" style={{ maxWidth: '60%', textAlign: 'right' }}>{order.customer?.address || order.shippingAddress}</span>
                </div>
                {(order.customer?.memo || order.addressMemo) && (
                    <div className="info-row">
                        <span className="info-label">Memo</span>
                        <span className="info-value">{order.customer?.memo || order.addressMemo}</span>
                    </div>
                )}
                {order.deliveryTime && (
                    <div className="info-row">
                        <span className="info-label">เวลาส่ง</span>
                        <span className="info-value" style={{ color: '#FF4B2B', fontWeight: '800' }}>{order.deliveryTime}</span>
                    </div>
                )}
                <div className="info-row">
                    <span className="info-label">ยอดรวม</span>
                    <span className="info-value">฿{Number(order.total).toLocaleString()}</span>
                </div>
            </div>

            <button className="back-home-btn" onClick={() => navigate('/store')}>
                <Home size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                กลับหน้าหลัก
            </button>
        </div>
    );
};

export default OrderTracking;
