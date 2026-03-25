import React, { useState } from 'react';
import { useShift } from '../contexts/ShiftContext';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { Clock, Banknote, TrendingUp, AlertTriangle, ChevronRight, ChevronDown, Calendar, History, Trash2, RotateCcw, Download } from 'lucide-react';
import { useProduct } from '../contexts/ProductContext';
import { useCustomer } from '../contexts/CustomerContext';
import './ShiftHistory.css';

const ShiftHistory = () => {
    const { currentShift, shiftHistory, voidTransaction, returnItem, exportShiftHistory, deleteShift, globalTransactions } = useShift();
    const { addStock } = useProduct();
    const { removeDebt } = useCustomer();
    const { t } = useLanguage();
    const [expandedShift, setExpandedShift] = useState(null);

    // Combine current shift with past history for a complete view
    const allShifts = currentShift
        ? [{ ...currentShift, isCurrent: true }, ...shiftHistory]
        : shiftHistory;

    const handleDeleteShift = async (e, id) => {
        e.stopPropagation();
        if (window.confirm(t('confirmDeleteShift') || 'คุณแน่ใจหรือไม่ที่จะลบประวัติกะนี้? ข้อมูลรายได้ของกะนี้จะหายไป')) {
            try {
                await deleteShift(id);
            } catch (error) {
                console.error("Failed to delete shift:", error);
                alert('Failed to delete shift');
            }
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const calculateDuration = (start, end) => {
        if (!end) return '-';
        const durationMs = new Date(end) - new Date(start);
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours} ชม. ${minutes} น.`;
    };

    const toggleExpand = (id) => {
        setExpandedShift(expandedShift === id ? null : id);
    };

    const handleVoid = async (tx, shiftId) => {
        if (window.confirm(t('confirmVoid') || 'ยืนยันการยกเลิกรายการนี้?')) {
            try {
                // 1. Revert Shift Totals
                await voidTransaction(tx.id, shiftId);

                // 2. Revert Stock
                for (const item of tx.items) {
                    await addStock(item.id, item.quantity);
                }

                // 3. Revert Debt if applicable
                if (tx.method === 'debt' && tx.customerId) {
                    await removeDebt(tx.customerId, tx.amount, tx.id);
                }

                alert('ยกเลิกรายการเรียบร้อยแล้ว');
            } catch (error) {
                console.error('Error voiding transaction:', error);
                alert('เกิดข้อผิดพลาด: ' + error.message);
            }
        }
    };

    const handleReturnItem = async (tx, item, shiftId) => {
        let returnQty = 1;
        if (item.quantity > 1) {
            const input = window.prompt(t('enterReturnQty')?.replace('{max}', item.quantity).replace('{unit}', item.unit || '') || `กรุณาใส่จำนวนที่ต้องการคืน (สูงสุด ${item.quantity})`);
            if (input === null) return;
            returnQty = parseInt(input);
            if (isNaN(returnQty) || returnQty <= 0) return;
            if (returnQty > item.quantity) {
                alert(t('returnQtyExceeded') || 'จำนวนเกินกว่าที่ซื้อ');
                return;
            }
        }

        try {
            // Calculate return amount for this portion
            const itemPrice = item.price || (item.amount / item.quantity);
            const returnAmount = itemPrice * returnQty;

            // 1. Revert Shift Totals & Transaction
            await returnItem(tx.id, item.id, returnQty, shiftId);

            // 2. Revert Stock
            await addStock(item.id, returnQty);

            // 3. Revert Debt if applicable
            if (tx.method === 'debt' && tx.customerId) {
                await removeDebt(tx.customerId, returnAmount, `${tx.id}-${item.name}`);
            }

            alert('คืนสินค้าเรียบร้อยแล้ว');
        } catch (error) {
            console.error('Error returning item:', error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
        }
    };

    return (
        <div className="shift-history-container">
            <div className="page-header">
                <div>
                    <h2 className="page-title">{t('shiftHistory')}</h2>
                    <p className="text-muted">{t('shiftHistoryDesc')}</p>
                </div>
                <Button
                    variant="outline"
                    icon={Download}
                    onClick={exportShiftHistory}
                    disabled={shiftHistory.length === 0}
                >
                    {t('exportCSV')}
                </Button>
            </div>

            {allShifts.length === 0 ? (
                <Card className="empty-state">
                    <History size={64} className="text-muted" />
                    <p>{t('noData')}</p>
                </Card>
            ) : (
                <div className="shift-history-list">
                    {allShifts.map(shift => {
                        const expectedCash = shift.startCash + shift.sales;
                        const diff = shift.actualCash !== undefined ? (shift.actualCash - expectedCash) : null;
                        const isExpanded = expandedShift === shift.id;
                        const isCurrent = shift.isCurrent;

                        return (
                            <Card key={shift.id} className={`shift-history-item ${isExpanded ? 'expanded' : ''}`}>
                                <div className="shift-history-summary" onClick={() => toggleExpand(shift.id)}>
                                    <div className="shift-main-info">
                                        <div className={`shift-status-icon ${isCurrent ? 'active' : 'success'}`}>
                                            {isCurrent ? <Clock size={20} /> : <Calendar size={20} />}
                                        </div>
                                        <div>
                                            <h4 className="shift-date">
                                                {formatDate(shift.startTime)}
                                                {isCurrent && <span className="current-badge">กำลังเปิดกะ</span>}
                                            </h4>
                                            <p className="shift-duration">
                                                <Clock size={14} /> {calculateDuration(shift.startTime, shift.endTime)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="shift-stats-summary">
                                        <div className="stat-pill">
                                            <span>{t('shiftSales')}</span>
                                            <strong>฿ {shift.sales.toFixed(2)}</strong>
                                        </div>
                                        {diff !== null && (
                                            <div className={`stat-pill diff ${diff >= 0 ? 'success' : 'danger'}`}>
                                                <span>{t('cashDiff')}</span>
                                                <strong>฿ {diff.toFixed(2)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {!isCurrent && (
                                        <div style={{ marginRight: '1rem' }}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-danger"
                                                onClick={(e) => handleDeleteShift(e, shift.id)}
                                                title={t('deleteShift') || 'ลบประวัติ'}
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </div>
                                    )}

                                    <div className="shift-expand-icon">
                                        {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="shift-history-details">
                                        <div className="details-grid">
                                            <div className="detail-card">
                                                <span className="detail-label">{t('startingCash')}</span>
                                                <p className="detail-value">฿ {shift.startCash.toFixed(2)}</p>
                                            </div>
                                            <div className="detail-card">
                                                <span className="detail-label">{t('shiftSales')}</span>
                                                <p className="detail-value">฿ {shift.sales.toFixed(2)}</p>
                                            </div>
                                            <div className="detail-card">
                                                <span className="detail-label">{t('expectedCash')}</span>
                                                <p className="detail-value">฿ {expectedCash.toFixed(2)}</p>
                                            </div>
                                            {shift.actualCash !== undefined && (
                                                <div className="detail-card highlight">
                                                    <span className="detail-label">{t('actualCash')}</span>
                                                    <p className="detail-value">฿ {shift.actualCash.toFixed(2)}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="transactions-section">
                                            <h5>{t('transactions')} ({shift.transactionCount || shift.transactions?.length || 0})</h5>
                                            <div className="transaction-history-list">
                                                {(() => {
                                                    const txs = (shift.transactions && shift.transactions.length > 0)
                                                        ? shift.transactions
                                                        : (globalTransactions || []).filter(t => t.shiftId === shift.id);

                                                    if (txs.length === 0) return <p className="text-muted text-sm">{t('noData')}</p>;

                                                    return txs.map((tx, idx) => (
                                                        <div key={idx} className={`tx-item ${tx.status === 'voided' ? 'voided' : ''}`}>
                                                            <div className="tx-details-wrapper">
                                                                <div className="tx-info">
                                                                    <span className="tx-time">{new Date(tx.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    <span className="tx-items-count">{tx.items.length} {t('items')}</span>
                                                                    {tx.status === 'voided' && <span className="void-status-tag">{t('voided')}</span>}
                                                                </div>
                                                                <div className="tx-right">
                                                                    <div className="tx-amount">฿ {tx.amount.toFixed(2)}</div>
                                                                    {tx.status !== 'voided' && (
                                                                        <button
                                                                            className="void-btn"
                                                                            onClick={(e) => { e.stopPropagation(); handleVoid(tx, shift.id); }}
                                                                            title={t('voidTransaction') || 'ยกเลิกรายการ'}
                                                                        >
                                                                            <RotateCcw size={16} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Item-level returns */}
                                                            {tx.status !== 'voided' && (
                                                                <div className="tx-items-list-mini">
                                                                    {tx.items.map(item => (
                                                                        <div key={item.id} className="tx-mini-item">
                                                                            <span>{item.name} x {item.quantity}</span>
                                                                            <button
                                                                                className="mini-return-btn"
                                                                                onClick={() => handleReturnItem(tx, item, shift.id)}
                                                                                title={t('returnProduct') || 'คืนสินค้า'}
                                                                            >
                                                                                {t('returnProduct') || 'คืนสินค้า'}
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ShiftHistory;
