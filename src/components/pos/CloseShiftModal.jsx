import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { useShift } from '../../contexts/ShiftContext';
import { LogOut, ClipboardCheck } from '../common/Icons';
import './CloseShiftModal.css';

const CloseShiftModal = ({ isOpen, onClose }) => {
    const { currentShift, closeShift } = useShift();
    const [actualCash, setActualCash] = useState('');
    const [diff, setDiff] = useState(0);

    // Calculate profit from transaction items
    const profit = React.useMemo(() => {
        if (!currentShift) return 0;
        let totalCost = 0;
        (currentShift.transactions || []).forEach(tx => {
            if (tx.type === 'sale' && tx.status !== 'voided') {
                (tx.items || []).forEach(item => {
                    totalCost += (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0);
                });
            }
        });
        return (currentShift.sales || 0) - totalCost;
    }, [currentShift]);

    const expectedCash = (currentShift?.startCash || 0) + (currentShift?.sales || 0);

    useEffect(() => {
        if (isOpen) {
            setActualCash('');
            setDiff(0);
        }
    }, [isOpen]);

    const handleCalculateDiff = (val) => {
        const cash = parseFloat(val) || 0;
        setActualCash(val);
        setDiff(cash - expectedCash);
    };

    const handleCloseShift = () => {
        if (window.confirm('Are you sure you want to close this shift?')) {
            closeShift(actualCash || 0);
            onClose();
            // Optionally redirect to summary page or print receipt
            alert('Shift Closed Successfully!');
        }
    };

    if (!currentShift) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Close Shift" size="md">
            <div className="close-shift-container">
                <div className="shift-summary-box">
                    <div className="summary-line">
                        <span>Start Time</span>
                        <span>{new Date(currentShift.startTime).toLocaleString()}</span>
                    </div>
                    <div className="summary-line">
                        <span>Starting Cash</span>
                        <span>฿ {currentShift.startCash.toFixed(2)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Total Sales</span>
                        <span>฿ {currentShift.sales.toFixed(2)}</span>
                    </div>
                    <div className="summary-line" style={{ color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                        <span>💰 กำไร (Profit)</span>
                        <span>฿ {profit.toFixed(2)}</span>
                    </div>
                    <div className="summary-line highlight">
                        <span>Expected Cash in Drawer</span>
                        <span>฿ {expectedCash.toFixed(2)}</span>
                    </div>
                </div>

                <div className="cash-count-section">
                    <Input
                        label="Actual Cash in Drawer"
                        type="number"
                        value={actualCash}
                        onChange={(e) => handleCalculateDiff(e.target.value)}
                        placeholder="Enter counted cash"
                    />

                    {actualCash && (
                        <div className={`diff-display ${diff >= 0 ? 'good' : 'bad'}`}>
                            <span>Difference:</span>
                            <span>{diff >= 0 ? '+' : ''}฿ {diff.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button className="btn-danger" icon={LogOut} onClick={handleCloseShift}>
                        Confirm Close Shift
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CloseShiftModal;
