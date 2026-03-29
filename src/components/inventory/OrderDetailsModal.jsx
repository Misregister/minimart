import React, { useState } from 'react';
import Modal from '../common/Modal'; // Use existing Modal
import ImageModal from '../common/ImageModal';
import { MapPin, Phone, User, FileText, ExternalLink, X, Image as ImageIcon } from 'lucide-react';

const OrderDetailsModal = ({ isOpen, onClose, order }) => {
    const [enlargedImage, setEnlargedImage] = useState(null);

    if (!order) return null;

    const location = order.customer?.location || order.location;
    const googleMapsUrl = location
        ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
        : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Order #${order.id.slice(0, 6)}`}
            size="md"
        >
            <div className="order-details-content">
                {/* Customer Info */}
                <div className="detail-section">
                    <div className="detail-row">
                        <User size={18} className="text-muted" />
                        <span className="font-bold">{order.customer?.name || order.customerName || 'ไม่ระบุชื่อ'}</span>
                    </div>
                    <div className="detail-row">
                        <Phone size={18} className="text-muted" />
                        <a href={`tel:${order.customer?.phone || order.customerPhone}`} className="phone-link">
                            {order.customer?.phone || order.customerPhone || '-'}
                        </a>
                    </div>
                </div>

                {/* Status Badge */}
                <div className={`status-badge status-${order.status}`} style={{ margin: '1rem 0' }}>
                    Status: {order.status.toUpperCase()}
                </div>

                {/* Address Section */}
                <div className="detail-section highlight-box">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <MapPin size={20} className="text-primary" style={{ marginTop: '4px' }} />
                        <div>
                            <div className="font-bold mb-1">ที่อยู่จัดส่ง</div>
                            <div style={{ fontSize: '1.1rem', lineHeight: '1.75' }}>{order.customer?.address || order.shippingAddress || 'ไม่ระบุที่อยู่จัดส่ง'}</div>
                            {(order.customer?.memo || order.addressMemo) && (
                                <div style={{ color: '#ef4444', marginTop: '4px', fontSize: '1.25rem', fontWeight: 600 }}>
                                    ** {order.customer?.memo || order.addressMemo} **
                                </div>
                            )}
                        </div>
                    </div>
                    {googleMapsUrl && (
                        <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="maps-link-btn"
                        >
                            <MapPin size={18} /> เปิด Google Maps
                        </a>
                    )}
                </div>

                {/* Order Items */}
                <div className="detail-section">
                    <h4 style={{ marginBottom: '0.5rem' }}>รายการสินค้า</h4>
                    <div className="item-list">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="item-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="item-thumbnail"
                                            onClick={() => setEnlargedImage(item.image)}
                                            style={{ cursor: 'pointer' }}
                                            title="คลิกเพื่อขยายรูป"
                                        />
                                    ) : (
                                        <div className="item-thumbnail placeholder">
                                            <ImageIcon size={20} color="#9ca3af" />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span className="font-bold">{item.name}</span>
                                        <span className="text-muted" style={{ fontSize: '0.9rem' }}>จำนวน: {item.quantity} {item.unit || 'ชิ้น'}</span>
                                    </div>
                                </div>
                                <span style={{ fontWeight: 600 }}>฿{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                    <div className="total-row" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #ccc' }}>
                        <span>ยอดรวม</span>
                        <span className="font-bold text-xl">฿{Number(order.total).toLocaleString()}</span>
                    </div>
                    <div className="payment-method">
                        ชำระเงิน: {order.paymentMethod === 'cod' ? 'เก็บเงินปลายทาง (COD)' : 'โอนเงิน'}
                    </div>
                </div>

                {/* Slip Image */}
                {order.slipUrl && (
                    <div className="detail-section">
                        <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FileText size={16} /> หลักฐานการโอน
                        </h4>
                        <a href={order.slipUrl} target="_blank" rel="noopener noreferrer">
                            <img src={order.slipUrl} alt="Slip" className="slip-preview" />
                        </a>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn-close" onClick={onClose}>ปิดหน้าต่าง</button>
                    {/* Add more actions if needed */}
                </div>
            </div>

            <ImageModal
                isOpen={!!enlargedImage}
                onClose={() => setEnlargedImage(null)}
                imageUrl={enlargedImage}
            />

            <style>{`
                .order-details-content {
                    padding: 1rem 0;
                }
                .detail-section {
                    margin-bottom: 1.5rem;
                }
                .detail-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                    font-size: 1.25rem;
                }
                .phone-link {
                    color: #3b82f6;
                    text-decoration: none;
                    font-weight: bold;
                    font-size: 1.25rem;
                }
                .highlight-box {
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 12px;
                    padding: 1.5rem;
                }
                .maps-link-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #2563eb;
                    color: white;
                    padding: 12px;
                    border-radius: 8px;
                    text-decoration: none;
                    margin-top: 1rem;
                    font-weight: 600;
                    transition: background 0.2s;
                    font-size: 1.25rem;
                }
                .maps-link-btn:hover {
                    background: #1d4ed8;
                }
                .item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    font-size: 1.1rem;
                    border-bottom: 1px solid #f3f4f6;
                }
                .item-row:last-child {
                    border-bottom: none;
                }
                .item-thumbnail {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    object-fit: contain;
                    border: 1px solid #e5e7eb;
                    background: white;
                    flex-shrink: 0;
                    transition: transform 0.2s;
                }
                .item-thumbnail:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .item-thumbnail.placeholder {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f9fafb;
                    cursor: default;
                }
                .item-thumbnail.placeholder:hover {
                    transform: none;
                    box-shadow: none;
                }
                .slip-preview {
                    width: 100%;
                    border-radius: 8px;
                    border: 1px solid #e5e7eb;
                    max-height: 300px;
                    object-fit: contain;
                    background: #f9fafb;
                }
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-pending { background: #fef9c3; color: #854d0e; }
                .status-preparing { background: #dbeafe; color: #1e40af; }
                .status-shipping { background: #ffedd5; color: #9a3412; }
                .status-delivered { background: #dcfce7; color: #166534; }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 1rem;
                }
                .btn-close {
                    background: #e5e7eb;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 1.25rem;
                }
                .text-muted { color: #6b7280; }
                .text-primary { color: #3b82f6; }
                .font-bold { font-weight: 700; }
                .text-xl { font-size: 1.25rem; }
            `}</style>
        </Modal>
    );
};

export default OrderDetailsModal;
