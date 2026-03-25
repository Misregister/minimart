import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { Save } from '../common/Icons';

const QuickAddProductModal = ({ isOpen, onClose, barcode, onConfirm }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const nameInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setPrice('');
            // Focus name input when opened
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen, barcode]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !price) return;
        onConfirm({
            name,
            price: parseFloat(price),
            barcode,
            category: 'Quick Add', // Default category
            showInPOS: true,
            stock: 100 // Default stock for quick add? Or 0? Let's say infinite or manage later. Infinite conceptually, but we need a number. 0 might show "Out of Stock".
            // Actually, if we add to cart, stock matters if we track it.
            // Let's set a reasonable default or maybe 1?
            // The user request says "save to temp stock and add to cart".
            // Maybe we just add it with stock 1 temporarily.
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="เพิ่มสินค้าด่วน (ไม่พบในระบบ)">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#991b1b', marginBottom: '0.5rem' }}>
                    ไม่พบสินค้าบาร์โค้ด: <strong>{barcode}</strong>
                </div>

                <Input
                    label="ชื่อสินค้า"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    ref={nameInputRef}
                    required
                    autoFocus
                />

                <Input
                    label="ราคา"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button variant="ghost" onClick={onClose} type="button">
                        ยกเลิก
                    </Button>
                    <Button onClick={handleSubmit} type="submit">
                        <Save size={16} /> บันทึกและขายเลย
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default QuickAddProductModal;
