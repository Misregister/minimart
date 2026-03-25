import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { Search, Plus, Minus, Trash2, Save, X } from 'lucide-react';
import { useProduct } from '../../contexts/ProductContext';
import { useOrder } from '../../contexts/OrderContext';

const EditOrderModal = ({ isOpen, onClose, order }) => {
    const { products, addStock, deductStock } = useProduct();
    const { updateOrderStatus, orders } = useOrder(); // We might need a specific updateOrder function in context later, or just update data directly via firestore in component? 
    // Actually OrderContext has `updateOrderStatus` but maybe not generic update.
    // Let's check OrderContext again. If it lacks updateOrder(data), we might need to add it or do it here.
    // For now, I'll assume we can use firestore directly or add a method.
    // Let's just implement the logic here for now using direct Supabase if needed or add to context.

    // Local state for editing
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (order) {
            setItems(JSON.parse(JSON.stringify(order.items))); // Deep copy
        }
    }, [order, isOpen]);

    // Search Products
    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lower = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            String(p.barcode).includes(lower)
        ).slice(0, 5);
    }, [searchTerm, products]);

    const handleAddItem = (product) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, {
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                // store original product data for stock calc
                isPack: false, // Default to unit for new adds
                isCase: false,
                originalId: product.id
            }];
        });
        setSearchTerm('');
    };

    const handleUpdateQty = (index, delta) => {
        setItems(prev => {
            const newItems = [...prev];
            const item = newItems[index];
            const newQty = item.quantity + delta;
            if (newQty <= 0) {
                // Remove
                return prev.filter((_, i) => i !== index);
            }
            newItems[index] = { ...item, quantity: newQty };
            return newItems;
        });
    };

    const handleRemoveItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const handleSave = async () => {
        if (!window.confirm('ยืนยันการแก้ไขออเดอร์? สต๊อกจะถูกปรับปรุงอัตโนมัติ')) return;
        setIsSubmitting(true);

        try {
            // 1. Revert OLD items to stock
            for (const oldItem of order.items) {
                let amount = oldItem.quantity;
                if (oldItem.isPack) amount *= (oldItem.packSize || 1);
                if (oldItem.isCase) amount *= (oldItem.caseSize || 1);
                await addStock(oldItem.originalId || oldItem.id, amount);
            }

            // 2. Deduct NEW items from stock
            for (const newItem of items) {
                let amount = newItem.quantity;
                if (newItem.isPack) amount *= (newItem.packSize || 1);
                if (newItem.isCase) amount *= (newItem.caseSize || 1);
                await deductStock(newItem.originalId || newItem.id, amount);
            }

            // 3. Update Order in Supabase
            const { supabase } = await import('../../services/supabase');

            const { error } = await supabase
                .from('orders')
                .update({
                    items: items,
                    total: calculateTotal(),
                    updatedAt: new Date().toISOString()
                })
                .eq('id', order.id);

            if (error) throw error;

            alert('บันทึกการแก้ไขเรียบร้อย');
            onClose();
        } catch (error) {
            console.error("Edit error:", error);
            alert("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`แก้ไขออเดอร์ #${order.id.slice(0, 6)}`} size="lg">
            <div className="edit-order-container">
                {/* Search Bar */}
                <div style={{ marginBottom: '1rem', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: '8px', padding: '8px' }}>
                        <Search size={20} color="#888" />
                        <input
                            style={{ border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '1rem' }}
                            placeholder="ค้นหาเพื่อเพิ่มสินค้า..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0,
                            background: 'white', border: '1px solid #ddd', borderRadius: '8px',
                            zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            marginTop: '4px'
                        }}>
                            {searchResults.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleAddItem(p)}
                                    style={{
                                        padding: '10px',
                                        borderBottom: '1px solid #eee',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>{p.name}</span>
                                    <span style={{ fontWeight: 'bold' }}>฿{p.price}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>สินค้า</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>ราคา</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>จำนวน</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>รวม</th>
                                <th style={{ padding: '8px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>{item.name}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>฿{item.price}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <button onClick={() => handleUpdateQty(index, -1)} style={btnStyle}><Minus size={14} /></button>
                                            <span style={{ minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                                            <button onClick={() => handleUpdateQty(index, 1)} style={btnStyle}><Plus size={14} /></button>
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>฿{(item.price * item.quantity).toLocaleString()}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        <button onClick={() => handleRemoveItem(index)} style={{ ...btnStyle, background: '#fee2e2', color: '#ef4444' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #eee', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        ยอดรวมใหม่: <span style={{ color: '#2563eb' }}>฿{calculateTotal().toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #ccc', background: 'white', cursor: 'pointer' }}>
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSubmitting}
                            style={{
                                padding: '10px 20px', borderRadius: '8px', border: 'none',
                                background: '#2563eb', color: 'white', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            {isSubmitting ? 'กำลังบันทึก...' : <><Save size={18} /> บันทึกการแก้ไข</>}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const btnStyle = {
    width: '24px', height: '24px',
    borderRadius: '4px', border: '1px solid #ddd',
    background: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
};

export default EditOrderModal;
