import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Clock, Trash2, Play, Package } from '../common/Icons';
import './ParkedBillsModal.css';

const ParkedBillsModal = ({ isOpen, onClose }) => {
    const { parkedCarts, resumeParkedCart, deleteParkedCart } = useCart();
    const { t } = useLanguage();

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('parkedBills')}
            size="md"
        >
            <div className="parked-bills-container">
                {parkedCarts.length === 0 ? (
                    <div className="empty-parked">
                        <Clock size={48} className="text-muted" />
                        <p>{t('noData')}</p>
                    </div>
                ) : (
                    <div className="parked-list">
                        {parkedCarts.map(bill => (
                            <div key={bill.id} className="parked-item">
                                <div className="parked-item-info">
                                    <div className="parked-time">
                                        <Clock size={16} />
                                        <span>{formatTime(bill.time)}</span>
                                    </div>
                                    <div className="parked-details">
                                        <Package size={16} />
                                        <span>{bill.items.length} {t('pieces')}</span>
                                        <span className="parked-total">฿ {bill.total.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="parked-item-actions">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-danger"
                                        onClick={() => deleteParkedCart(bill.id)}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={Play}
                                        onClick={() => {
                                            resumeParkedCart(bill.id);
                                            onClose();
                                        }}
                                    >
                                        {t('resume')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ParkedBillsModal;
