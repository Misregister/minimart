import React, { useEffect, useRef, useState } from 'react';
import { useOrder } from '../contexts/OrderContext';
import { useProduct } from '../contexts/ProductContext';
import { Clock, Package, Truck, CheckCircle, FileText, MapPin, Trash2, XCircle, Edit, Volume2, VolumeX } from 'lucide-react';
import OrderDetailsModal from '../components/inventory/OrderDetailsModal';
import EditOrderModal from '../components/inventory/EditOrderModal';
import './OrderManager.css';

// Base64 generic bell/ding sound (very short and clean)
const BEEP_URL = "data:audio/mp3;base64,//OExAA... (base64 string will be short, wait, actually I should use a valid base64 or a public URL). Let's use a public notification sound or standard browser beep.";
// Actually, I'll use a reliable public URL for a notification bell to ensure it plays, or a tiny data URI.
const NOTIFICATION_SOUND = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg";

const OrderManager = () => {
    const { orders, updateOrderStatus, newOrderAlert, acknowledgeNewOrder } = useOrder();
    const { deductStock, addStock } = useProduct();
    const [soundEnabled, setSoundEnabled] = useState(true);
    const prevPendingCount = useRef(0);
    const audioRef = useRef(new Audio(NOTIFICATION_SOUND));

    const getOrdersByStatus = (status) => {
        return orders.filter(o => o.status === status).sort((a, b) => {
            if (a.deliveryTime && b.deliveryTime) {
                return a.deliveryTime.localeCompare(b.deliveryTime);
            }
            if (a.deliveryTime && !b.deliveryTime) return -1;
            if (!a.deliveryTime && b.deliveryTime) return 1;
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    };

    // Audio Notification Logic
    useEffect(() => {
        const currentPendingCount = getOrdersByStatus('pending').length;

        // If pending orders increased, play sound
        if (currentPendingCount > prevPendingCount.current) {
            if (soundEnabled) {
                audioRef.current.play().catch(err => console.log("Audio play blocked by browser:", err));
            }
        }

        prevPendingCount.current = currentPendingCount;
    }, [orders, soundEnabled]);

    const handleNextStatus = async (orderId, currentStatus) => {
        let nextStatus = '';
        if (currentStatus === 'pending') nextStatus = 'preparing';
        if (currentStatus === 'preparing') nextStatus = 'shipping';
        if (currentStatus === 'shipping') nextStatus = 'delivered';

        if (nextStatus) {
            // Deduct stock when moving from pending to preparing (Accept Order)
            if (currentStatus === 'pending' && nextStatus === 'preparing') {
                const order = orders.find(o => o.id === orderId);
                if (order) {
                    for (const item of (order.items || [])) {
                        let deductAmount = item.quantity;
                        if (item.isPack) deductAmount = item.quantity * (item.packSize || 1);
                        if (item.isCase) deductAmount = item.quantity * (item.caseSize || 1);

                        // Use originalId if available (for pack/case items), otherwise id
                        await deductStock(item.originalId || item.id, deductAmount);
                    }
                }
            }
            await updateOrderStatus(orderId, nextStatus);
        }
    };

    const handleDelete = async (orderId) => {
        if (window.confirm('ยืนยันซ่อน/ลบออเดอร์นี้จากหน้ากระดาน? (ข้อมูลจะยังถูกเก็บในฐานข้อมูล)')) {
            await updateOrderStatus(orderId, 'archived');
        }
    };

    const handleClearDelivered = async () => {
        const deliveredOrders = getOrdersByStatus('delivered');
        if (deliveredOrders.length === 0) return;

        if (window.confirm(`ยืนยันซ่อนประวัติออเดอร์ที่สำเร็จแล้วทั้งหมดจากหน้ากระดาน (${deliveredOrders.length} รายการ)?`)) {
            for (const order of deliveredOrders) {
                await updateOrderStatus(order.id, 'archived');
            }
        }
    };

    const [selectedOrder, setSelectedOrder] = React.useState(null);
    const [editingOrder, setEditingOrder] = React.useState(null);

    const OrderCard = ({ order }) => (
        <div className={`order-card ${order.deliveryTime ? 'has-delivery-time' : ''}`} onClick={() => setSelectedOrder(order)}>
            <div className="order-header">
                <span>#{order.id.slice(0, 6)}</span>
                <span>{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>

            {order.deliveryTime && (
                <div style={{
                    background: '#fff7ed', border: '1px solid #fdba74', color: '#ea580c',
                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold',
                    marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                    <Clock size={14} /> รอบส่ง: {order.deliveryTime} น.
                </div>
            )}

            <div className="order-customer" style={{ marginTop: '8px' }}>
                {order.customer?.name || order.customerName || 'ไม่ระบุชื่อผู้รับ'}
                <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 'normal' }}> ({order.customer?.phone || order.customerPhone || '-'})</span>
            </div>

            <div className="order-address">
                <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {order.customer?.address || order.shippingAddress || 'ไม่ระบุที่อยู่จัดส่ง'}
                {(order.customer?.memo || order.addressMemo) && <span style={{ color: '#ef4444', marginLeft: '4px' }}>** {order.customer?.memo || order.addressMemo} **</span>}
            </div>

            <div className="order-items-preview">
                {(order.items || []).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.quantity} x {item.name}</span>
                    </div>
                ))}
            </div>

            {order.slipUrl && (
                <div style={{ fontSize: '0.8rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                    <FileText size={12} /> มีสลิปโอนเงิน
                </div>
            )}

            <div className="order-footer">
                <div className="order-total">฿{Number(order.total).toLocaleString()}</div>
                <div>{order.paymentMethod === 'cod' ? 'COD' : 'โอนเงิน'}</div>
            </div>

            {/* Note: Stop propagation for buttons to prevent opening modal when clicking action buttons */}
            {order.status === 'pending' && (
                <button className="action-btn btn-prepare" onClick={(e) => { e.stopPropagation(); handleNextStatus(order.id, 'pending'); }}>
                    รับออเดอร์ / จัดของ
                </button>
            )}
            {order.status === 'preparing' && (
                <button className="action-btn btn-ship" onClick={(e) => { e.stopPropagation(); handleNextStatus(order.id, 'preparing'); }}>
                    ส่งสินค้า
                </button>
            )}
            {order.status === 'shipping' && (
                <button className="action-btn btn-complete" onClick={(e) => { e.stopPropagation(); handleNextStatus(order.id, 'shipping'); }}>
                    ปิดงาน (ส่งสำเร็จ)
                </button>
            )}
            {order.status === 'delivered' && (
                <button
                    className="action-btn"
                    style={{ backgroundColor: '#fee2e2', color: '#ef4444', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                >
                    <Trash2 size={14} /> ลบประวัติ
                </button>
            )}

            {/* Void & Edit Buttons for Active Orders */}
            {(order.status === 'preparing' || order.status === 'shipping') && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                        className="action-btn"
                        style={{
                            backgroundColor: '#6b7280',
                            color: 'white',
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}
                        onClick={(e) => { e.stopPropagation(); handleVoidOrder(order.id); }}
                    >
                        <XCircle size={14} /> ยกเลิก
                    </button>
                    <button
                        className="action-btn"
                        style={{
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}
                        onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }}
                    >
                        <Edit size={14} /> แก้ไข
                    </button>
                </div>
            )}
        </div>
    );

    const handleVoidOrder = async (orderId) => {
        if (!window.confirm('ต้องการยกเลิกบิลนี้และคืนสินค้าเข้าสต๊อกใช่หรือไม่?')) return;

        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        try {
            // 1. Restock Items
            for (const item of (order.items || [])) {
                let restockAmount = item.quantity;
                // Calculate raw units if it was a pack/case
                if (item.isPack) restockAmount = item.quantity * (item.packSize || 1);
                if (item.isCase) restockAmount = item.quantity * (item.caseSize || 1);

                // Add back as 'unit' because we calculated the raw total
                await addStock(item.originalId || item.id, restockAmount, 'unit');
            }

            // 2. Mark Order as Cancelled (Soft Delete)
            await updateOrderStatus(orderId, 'cancelled');
            alert('ยกเลิกบิลและคืนสต๊อกเรียบร้อยแล้ว');
        } catch (error) {
            console.error("Void error:", error);
            alert("เกิดข้อผิดพลาดในการยกเลิกบิล");
        }
    };

    return (
        <div className="order-manager-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>จัดการออเดอร์เดลิเวอรี่ 🛵</h2>

                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', borderRadius: '8px',
                        border: '1px solid #d1d5db', background: 'white',
                        color: soundEnabled ? '#059669' : '#6b7280',
                        cursor: 'pointer', fontWeight: 600
                    }}
                >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    {soundEnabled ? 'เปิดเสียงเตือน' : 'ปิดเสียงเตือน'}
                </button>
            </div>

            {/* ... Kanban Board ... */}
            <div className="kanban-board">
                {/* Pending */}
                <div className="kanban-column">
                    <div className="column-header">
                        <div className="column-title"><Clock size={18} color="#eab308" /> รอรับออเดอร์</div>
                        <span className="column-count">{getOrdersByStatus('pending').length}</span>
                    </div>
                    <div className="column-content">
                        {getOrdersByStatus('pending').map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>

                {/* Preparing */}
                <div className="kanban-column">
                    <div className="column-header">
                        <div className="column-title"><Package size={18} color="#3b82f6" /> กำลังจัดของ</div>
                        <span className="column-count">{getOrdersByStatus('preparing').length}</span>
                    </div>
                    <div className="column-content">
                        {getOrdersByStatus('preparing').map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>

                {/* Shipping */}
                <div className="kanban-column">
                    <div className="column-header">
                        <div className="column-title"><Truck size={18} color="#f97316" /> กำลังนำส่ง</div>
                        <span className="column-count">{getOrdersByStatus('shipping').length}</span>
                    </div>
                    <div className="column-content">
                        {getOrdersByStatus('shipping').map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>

                {/* Delivered (Today) */}
                <div className="kanban-column">
                    <div className="column-header">
                        <div className="column-title"><CheckCircle size={18} color="#22c55e" /> สำเร็จ (วันนี้)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getOrdersByStatus('delivered').length > 0 && (
                                <button
                                    onClick={handleClearDelivered}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                                    title="ลบทั้งหมด"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <span className="column-count">{getOrdersByStatus('delivered').length}</span>
                        </div>
                    </div>
                    <div className="column-content">
                        {getOrdersByStatus('delivered').map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>
            </div>

            <EditOrderModal
                isOpen={!!editingOrder}
                onClose={() => setEditingOrder(null)}
                order={editingOrder}
            />
            <OrderDetailsModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
            />
        </div>
    );
};

export default OrderManager;
