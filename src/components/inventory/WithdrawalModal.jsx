
import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { useProduct } from '../../contexts/ProductContext';
import { useShift } from '../../contexts/ShiftContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LogOut, Check } from 'lucide-react';
import './WithdrawalModal.css';

const REASONS = [
    { id: 'owner_consume', label: { th: 'เจ้าของทานเอง / ใช้เอง', en: 'Owner Consumed' } },
    { id: 'expired', label: { th: 'สินค้าหมดอายุ', en: 'Expired' } },
    { id: 'damaged', label: { th: 'สินค้าชำรุด / เสียหาย', en: 'Damaged' } },
    { id: 'marketing', label: { th: 'แจกฟรี / การตลาด', en: 'Free / Marketing' } },
    { id: 'other', label: { th: 'อื่นๆ', en: 'Other' } }
];

const WithdrawalModal = ({ isOpen, onClose, product }) => {
    const { withdrawStock } = useProduct();
    const { recordWithdrawal, isShiftOpen } = useShift();
    const { t, language } = useLanguage();

    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('owner_consume');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product || !quantity || quantity <= 0) return;

        // Validation: Cannot withdraw more than stock? 
        // Optional. For now let's allow negative stock if they really want, but warn?
        // Let's just allow it for flexibility.

        setIsSubmitting(true);
        try {
            const qty = parseFloat(quantity);
            // 1. Deduct Stock (No Sales)
            await withdrawStock(product.id, qty);

            // 2. Record Transaction (if shift is open)
            if (isShiftOpen) {
                await recordWithdrawal([{ ...product, quantity: qty }], reason, note);
            }

            onClose();
            setQuantity('');
            setNote('');
            setReason('owner_consume');
            alert(language === 'th' ? 'บันทึกการเบิกสำเร็จ' : 'Withdrawal recorded');
        } catch (error) {
            console.error(error);
            alert('Failed to record withdrawal');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!product) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={language === 'th' ? 'เบิกสินค้า / ตัดสต๊อก' : 'Withdraw Stock'} size="sm">
            <form onSubmit={handleSubmit} className="withdrawal-form">
                <div className="product-summary">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted">{product.barcode}</p>
                    <p className="text-sm">
                        {language === 'th' ? 'คงเหลือ:' : 'Current Stock:'}
                        <span className="font-bold"> {product.stock} {product.unit}</span>
                    </p>
                </div>

                <div className="form-group">
                    <Input
                        label={language === 'th' ? 'จำนวนที่เบิก' : 'Quantity'}
                        type="number"
                        min="0.1"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label className="input-label">{language === 'th' ? 'เหตุผล' : 'Reason'}</label>
                    <select
                        className="input-field"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    >
                        {REASONS.map(r => (
                            <option key={r.id} value={r.id}>
                                {language === 'th' ? r.label.th : r.label.en}
                            </option>
                        ))}
                    </select>
                </div>

                {reason === 'other' && (
                    <div className="form-group">
                        <Input
                            label={language === 'th' ? 'หมายเหตุ' : 'Note'}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="..."
                        />
                    </div>
                )}

                {!isShiftOpen && (
                    <div className="alert-warning" style={{ fontSize: '0.8rem', padding: '0.5rem', marginBottom: '1rem', background: '#fff3cd', color: '#856404', borderRadius: '4px' }}>
                        {language === 'th' ? '⚠️ เตือน: กะยังไม่เปิด การเบิกนี้จะตัดสต๊อกแต่ไม่บันทึกลงกะปัจจุบัน' : 'Warning: Shift is closed. Stock will be deducted but not recorded in shift.'}
                    </div>
                )}

                <div className="form-actions">
                    <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
                    <Button type="submit" variant="danger" isLoading={isSubmitting} icon={LogOut}>
                        {language === 'th' ? 'ยืนยันการเบิก' : 'Confirm Withdraw'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default WithdrawalModal;
