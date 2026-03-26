import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { Banknote, CreditCard, Check, QrCode, ClipboardCheck, User, Edit } from '../common/Icons';
import { QRCodeSVG } from 'qrcode.react';
import { useCart } from '../../contexts/CartContext';
import { useProduct } from '../../contexts/ProductContext';
import { useShift } from '../../contexts/ShiftContext';
import { useCustomer } from '../../contexts/CustomerContext';
import { useSettings } from '../../contexts/SettingsContext';
import generatePayload from 'promptpay-qr';
import { updateQrAmount } from '../../services/emvqr';
const STATIC_QR = "00020101021130650016A000000677010112011501075360001028602150140000047446780303SCB5802TH530376462200716000000000068782963040ACD";

const PaymentModal = ({ isOpen, onClose }) => {
    const { cart, total, clearCart } = useCart();
    const { deductStock, bulkDeductStock } = useProduct();
    const { recordTransaction } = useShift();
    const { customers, addDebt } = useCustomer();
    const { shopSettings } = useSettings();

    const [method, setMethod] = useState('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [finalChange, setFinalChange] = useState(0);

    // Split Payment State
    const [splitCash, setSplitCash] = useState('');
    const [splitTransfer, setSplitTransfer] = useState('');

    // Credit Payment State
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [creditNote, setCreditNote] = useState('');

    // Sync to Customer Display via BroadcastChannel (Local) & Firestore (Remote)
    useEffect(() => {
        if (isOpen) {
            // Calculate QR Payload dynamically
            let currentQrPayload = null;
            if (method === 'qrcode') {
                currentQrPayload = updateQrAmount(STATIC_QR, total);
            } else if (method === 'split' && parseFloat(splitTransfer || 0) > 0) {
                currentQrPayload = updateQrAmount(STATIC_QR, parseFloat(splitTransfer || 0));
            }

            const data = {
                type: isSuccess ? 'success' : (method ? 'payment' : 'cart'),
                cart,
                total,
                paymentMethod: method,
                qrPayload: currentQrPayload,
                change: finalChange,
                received: parseFloat(cashReceived || 0),
                timestamp: Date.now(),
                // Add split details for display
                splitDetails: method === 'split' ? {
                    cash: parseFloat(splitCash || 0),
                    transfer: parseFloat(splitTransfer || 0)
                } : null
            };

            // 1. Local Sync (Fast, Same Device)
            const channel = new BroadcastChannel('pos_customer_display');
            channel.postMessage(data);
            channel.close();
        }
    }, [isOpen, cart, total, method, isSuccess, finalChange, cashReceived, splitCash, splitTransfer]);

    const filteredCustomers = searchTerm
        ? customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
        : [];

    const change = parseFloat(cashReceived || 0) - total;

    useEffect(() => {
        if (isOpen) {
            setMethod('cash');
            setCashReceived('');
            setSplitCash('');
            setSplitTransfer('');
            setSelectedCustomer(null);
            setSearchTerm('');
            setCreditNote('');
            setIsSuccess(false);
        }
    }, [isOpen]);

    // Split payment calculations
    const splitCashAmount = parseFloat(splitCash || 0);
    const splitTransferAmount = parseFloat(splitTransfer || 0);
    const splitTotal = splitCashAmount + splitTransferAmount;
    const splitRemaining = total - splitTotal;
    const splitChange = splitCashAmount > 0 ? Math.max(0, splitTotal - total) : 0;

    const handlePayment = async () => {
        if (method === 'cash' && change < 0) {
            alert('เงินที่รับไม่เพียงพอ');
            return;
        }

        if (method === 'split' && splitTotal < total) {
            alert(`ยอดรวมยังไม่ครบ ขาดอีก ฿${splitRemaining.toFixed(2)}`);
            return;
        }

        if (method === 'credit' && !selectedCustomer) {
            alert('กรุณาเลือกลูกค้าสมาชิกสำหรับเงินเชื่อ');
            return;
        }

        setIsProcessing(true);
        try {
            // STEP 1: Pre-calculate everything (Zero network latency)
            const deductions = cart.map(item => {
                let deductAmount = item.quantity;
                if (item.isPack) deductAmount = item.quantity * (item.packSize || 1);
                if (item.isCase) deductAmount = item.quantity * (item.caseSize || 1);
                return { productId: item.originalId || item.id, amount: deductAmount };
            });

            let changeAmount = 0;
            let cashIn = total;
            let paymentMethodRecord = method;

            if (method === 'cash') {
                changeAmount = change;
                cashIn = parseFloat(cashReceived);
            } else if (method === 'split') {
                changeAmount = splitChange;
                cashIn = splitCashAmount;
                paymentMethodRecord = `split:cash=${splitCashAmount},transfer=${splitTransferAmount}`;
            }

            const txParams = {
                items: cart,
                total: total,
                paymentMethod: paymentMethodRecord,
                cashReceived: cashIn,
                transferAmount: method === 'split' ? splitTransferAmount : (method === 'qrcode' ? total : 0),
                change: changeAmount,
                customerId: method === 'credit' ? selectedCustomer?.id : null,
                customerName: method === 'credit' ? selectedCustomer?.name : null,
                note: method === 'credit' ? creditNote : null,
                timestamp: new Date()
            };

            // STEP 2: Fire ALL database operations in PARALLEL! 🚀
            console.log(`[Turbo] ⚡ Processing payment parallel...`);
            const parallelOps = [
                bulkDeductStock(deductions),
                recordTransaction(txParams)
            ];

            if (method === 'credit' && selectedCustomer) {
                parallelOps.push(addDebt(selectedCustomer.id, total, `POS-${Date.now()}`));
            }

            await Promise.all(parallelOps);

            // STEP 3: Instant UI transition
            clearCart();
            setFinalChange(changeAmount);
            setIsSuccess(true);

        } catch (error) {
            console.error('Payment failure details:', error);
            // Provide more descriptive alert
            const errorMessage = error?.message || 'Unknown error';
            alert(`เกิดข้อผิดพลาดในการชำระเงิน: ${errorMessage}`);
            // onClose(); // Don't close immediately so user can read the error carefully
        } finally {
            setIsProcessing(false);
        }
    };

    // Base64 Success Sound (Simple Chime)
    const playSuccessSound = () => {
        try {
            const audioData = "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAADAAALMAAAWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY//uQxAAAADH8MAAAAAAA0gAAABF1aW0AAAAAABpAAAACBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uQxAAAAAAA0gAAAAABBQAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
            // Note: The string above is a placeholder. I will use a real short beep effect in the actual code or a browser beep. 
            // Since I cannot upload a file, I will use a reliable public URL or just relying on the visual for now if sound fails.
            // Actually, best to use a real URL or synthesis.
            // Let's use a synthesis beep for reliability without external assets.

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            }
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const handleCloseSuccess = () => {
        setIsSuccess(false);
        onClose();
    };

    // TTS Function
    const speakSuccess = () => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance();
            utterance.lang = 'th-TH';
            utterance.rate = 1;

            if (finalChange > 0) {
                utterance.text = `เงินทอน ${finalChange} บาท ขอบคุณครับ`;
            } else {
                utterance.text = 'ขอบคุณครับ';
            }

            window.speechSynthesis.speak(utterance);
        }
    };

    // Auto-close effect
    useEffect(() => {
        if (isSuccess) {
            playSuccessSound();
            speakSuccess(); // Call TTS
            const timer = setTimeout(() => {
                handleCloseSuccess();
            }, 15000); // 15 seconds delay as requested
            return () => clearTimeout(timer);
        }
    }, [isSuccess]);

    const quickAmounts = [20, 50, 100, 500, 1000];
    const handleQuickAmount = (amount) => {
        const current = parseFloat(cashReceived || 0);
        setCashReceived((current + amount).toString());
    };

    const styles = {
        container: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem',
            height: 'calc(90vh - 100px)',
            overflow: 'hidden'
        },
        methodsGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            flexShrink: 0
        },
        methodBtn: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            background: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.9rem',
            fontWeight: '600',
            height: '80px'
        },
        methodBtnActive: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderColor: '#667eea',
            color: 'white'
        },
        totalBox: {
            textAlign: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1rem',
            borderRadius: '12px',
            color: 'white',
            flexShrink: 0
        },
        totalLabel: {
            fontSize: '0.9rem',
            opacity: 0.9,
            marginBottom: '0.25rem'
        },
        totalAmount: {
            fontSize: '2rem',
            fontWeight: '800',
            margin: 0
        },
        contentSection: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: 1,
            minHeight: 0
        },
        mainContent: {
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '1rem',
            flex: 1,
            minHeight: 0
        },
        numpadGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            height: '100%'
        },
        numpadBtn: {
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            background: 'white',
            fontSize: '3rem',
            fontWeight: 'bold',
            color: '#1f2937',
            cursor: 'pointer',
            transition: 'all 0.1s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        },
        clearBtn: {
            color: '#ef4444',
            borderColor: '#fee2e2',
            background: '#fef2f2'
        },
        backspaceBtn: {
            gridColumn: '1 / -1',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            color: '#4b5563',
            fontSize: '2.5rem',
            cursor: 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        quickColumn: {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
        },
        quickBtn: {
            flex: 1,
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            background: 'white',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '1.25rem',
            transition: 'all 0.2s',
            color: '#4b5563'
        },
        changeBox: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb',
            background: '#f9fafb',
            marginTop: '1rem'
        },
        changeBoxPositive: {
            background: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.3)'
        },
        changeBoxNegative: {
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
        },
        changeLabel: {
            fontSize: '1rem',
            color: '#6b7280',
            fontWeight: '500',
            marginBottom: '0.25rem'
        },
        changeAmount: {
            fontSize: '2.5rem',
            fontWeight: '800',
            margin: 0
        },
        changeAmountPositive: {
            color: 'rgb(34, 197, 94)'
        },
        changeAmountNegative: {
            color: 'rgb(239, 68, 68)'
        },
        actionsGrid: {
            display: 'grid',
            gridTemplateColumns: method === 'cash' ? '1fr 1fr 2fr' : '1fr 2fr',
            gap: '1rem',
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid #e5e7eb',
            flexShrink: 0
        },
        successContainer: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '2rem',
            textAlign: 'center'
        },
        changeDisplay: {
            fontSize: '4rem',
            fontWeight: '800',
            color: '#10b981',
            margin: '1rem 0'
        },
        qrContainer: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            height: '100%',
            padding: '1rem',
            background: '#f9fafb',
            borderRadius: '16px',
            border: '2px solid #e5e7eb'
        },
        creditContainer: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            padding: '2rem',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            height: '100%'
        },

    };

    if (isSuccess) {
        return (
            <Modal isOpen={isOpen} onClose={handleCloseSuccess} title="ชำระเงินสำเร็จ" size="lg">
                <div style={styles.successContainer}>
                    <div style={{ background: '#d1fae5', padding: '1.5rem', borderRadius: '50%' }}>
                        <Check size={64} color="#059669" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>ชำระเงินเรียบร้อยแล้ว</h2>
                        <p style={{ color: '#6b7280' }}>
                            {method === 'credit' ? `บันทึกยอดเงินเชื่อ: คุณ ${selectedCustomer?.name} ` : 'ขอบคุณที่ใช้บริการ'}
                        </p>
                    </div>

                    {method === 'cash' && (
                        <div>
                            <div style={{ fontSize: '1.25rem', color: '#6b7280' }}>เงินทอน</div>
                            <div style={styles.changeDisplay}>฿{finalChange.toFixed(2)}</div>
                        </div>
                    )}

                    <Button
                        onClick={handleCloseSuccess}
                        size="lg"
                        style={{ width: '100%', maxWidth: '300px', height: '60px', fontSize: '1.25rem' }}
                    >
                        ปิดหน้าต่าง (Enter)
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ชำระเงิน" size="lg">
            <div style={styles.container}>
                {/* Payment Methods */}
                <div style={{ ...styles.methodsGrid, gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <button
                        style={{
                            ...styles.methodBtn,
                            ...(method === 'cash' ? styles.methodBtnActive : {})
                        }}
                        onClick={() => setMethod('cash')}
                    >
                        <Banknote size={24} />
                        <span>เงินสด</span>
                    </button>
                    <button
                        style={{
                            ...styles.methodBtn,
                            ...(method === 'qrcode' ? styles.methodBtnActive : {})
                        }}
                        onClick={() => setMethod('qrcode')}
                    >
                        <QrCode size={24} />
                        <span>โอน</span>
                    </button>
                    <button
                        style={{
                            ...styles.methodBtn,
                            ...(method === 'split' ? styles.methodBtnActive : {}),
                            background: method === 'split' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'white',
                            borderColor: method === 'split' ? '#f59e0b' : '#e5e7eb'
                        }}
                        onClick={() => setMethod('split')}
                    >
                        <CreditCard size={24} />
                        <span>แยกจ่าย</span>
                    </button>
                    <button
                        style={{
                            ...styles.methodBtn,
                            ...(method === 'credit' ? styles.methodBtnActive : {})
                        }}
                        onClick={() => setMethod('credit')}
                    >
                        <ClipboardCheck size={24} />
                        <span>เชื่อ</span>
                    </button>

                </div>

                {/* Total */}
                <div style={styles.totalBox}>
                    <div style={styles.totalLabel}>ยอดรวม</div>
                    <h2 style={styles.totalAmount}>฿{total.toFixed(2)}</h2>
                </div>

                {/* Content Based on Method */}
                {method === 'cash' && (
                    <div style={styles.contentSection}>
                        <Input
                            label="รับเงิน"
                            type="number"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            placeholder="0.00"
                            autoFocus
                            style={{ fontSize: '2rem', padding: '0.75rem', fontWeight: 'bold' }}
                        />

                        <div style={styles.mainContent}>
                            {/* Numpad */}
                            <div style={styles.numpadGrid}>
                                {[7, 8, 9, 4, 5, 6, 1, 2, 3, 'C', 0, '.'].map((key) => (
                                    <button
                                        key={key}
                                        style={{
                                            ...styles.numpadBtn,
                                            ...(key === 'C' ? styles.clearBtn : {})
                                        }}
                                        onClick={() => {
                                            if (key === 'C') {
                                                setCashReceived('');
                                            } else if (key === '.') {
                                                if (!cashReceived.includes('.')) {
                                                    setCashReceived(prev => prev + key);
                                                }
                                            } else {
                                                setCashReceived(prev => prev + key);
                                            }
                                        }}
                                    >
                                        {key}
                                    </button>
                                ))}
                                <button
                                    style={styles.backspaceBtn}
                                    onClick={() => setCashReceived(prev => prev.slice(0, -1))}
                                >
                                    ⌫
                                </button>
                            </div>

                            {/* Quick Amounts */}
                            <div style={styles.quickColumn}>
                                {quickAmounts.map(amount => (
                                    <button
                                        key={amount}
                                        style={styles.quickBtn}
                                        onClick={() => handleQuickAmount(amount)}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#f3f4f6';
                                            e.target.style.borderColor = '#667eea';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'white';
                                            e.target.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        +{amount}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {method === 'qrcode' && (
                    <div style={styles.qrContainer}>
                        <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                            {/* User requested specific static QR */}
                            {/* User requested specific static QR with Dynamic Amount */}
                            <QRCodeSVG
                                value={updateQrAmount(STATIC_QR, total)}
                                size={200}
                                level="L"
                                includeMargin={true}
                            />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>แสกน QR Code เพื่อชำระเงิน</p>
                            <h3 style={{ fontSize: '2rem', color: '#10b981', margin: 0 }}>฿{total.toFixed(2)}</h3>
                            <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.5rem' }}>PromptPay</p>
                        </div>
                    </div>
                )}

                {method === 'split' && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                        borderRadius: '16px',
                        border: '2px solid #fcd34d',
                        flex: 1
                    }}>
                        <h3 style={{ margin: 0, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CreditCard size={24} /> แยกจ่าย (เงินสด + โอน)
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem', display: 'block' }}>
                                    <Banknote size={16} style={{ marginRight: '0.5rem' }} />
                                    เงินสด
                                </label>
                                <input
                                    type="number"
                                    value={splitCash}
                                    onChange={(e) => setSplitCash(e.target.value)}
                                    placeholder="0.00"
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        border: '2px solid #fcd34d',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        background: 'white'
                                    }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.5rem', display: 'block' }}>
                                    <QrCode size={16} style={{ marginRight: '0.5rem' }} />
                                    โอน/PromptPay
                                </label>
                                <input
                                    type="number"
                                    value={splitTransfer}
                                    onChange={(e) => setSplitTransfer(e.target.value)}
                                    placeholder="0.00"
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        border: '2px solid #10b981',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        background: 'white'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem',
                            padding: '1rem',
                            background: 'white',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>รวมรับ</div>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: splitTotal >= total ? '#10b981' : '#f59e0b'
                                }}>
                                    ฿{splitTotal.toFixed(2)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                    {splitRemaining > 0 ? 'ขาดอีก' : 'ทอน'}
                                </div>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: splitRemaining > 0 ? '#ef4444' : '#10b981'
                                }}>
                                    ฿{splitRemaining > 0 ? splitRemaining.toFixed(2) : splitChange.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Quick fill buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSplitCash(total.toString());
                                    setSplitTransfer('0');
                                }}
                            >
                                เงินสดทั้งหมด
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSplitCash('0');
                                    setSplitTransfer(total.toString());
                                }}
                            >
                                โอนทั้งหมด
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const half = (total / 2).toFixed(2);
                                    setSplitCash(half);
                                    setSplitTransfer(half);
                                }}
                            >
                                แบ่งครึ่ง
                            </Button>
                            {splitCashAmount > 0 && splitRemaining !== 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    style={{ background: '#10b981', color: 'white', borderColor: '#10b981' }}
                                    onClick={() => {
                                        setSplitTransfer(Math.max(0, total - splitCashAmount).toFixed(2));
                                    }}
                                >
                                    โอนส่วนที่เหลือ ({(total - splitCashAmount).toFixed(2)})
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {method === 'credit' && (
                    <div style={styles.creditContainer}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={24} /> ข้อมูลลูกค้าสมาชิก
                        </h3>

                        {!selectedCustomer ? (
                            <div style={{ position: 'relative' }}>
                                <Input
                                    label="ค้นหาสมาชิก (ชื่อ หรือ เบอร์โทร)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="พิมพ์เพื่อค้นหา..."
                                    autoFocus
                                    style={{ fontSize: '1.2rem' }}
                                />
                                {searchTerm && filteredCustomers.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        zIndex: 10,
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        {filteredCustomers.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setSearchTerm('');
                                                }}
                                                style={{
                                                    padding: '0.75rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f3f4f6',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                                                onMouseLeave={(e) => e.target.style.background = 'white'}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: '600' }}>{c.name}</div>
                                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{c.phone}</div>
                                                </div>
                                                {c.totalDebt > 0 && (
                                                    <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: '500' }}>
                                                        ติดหนี้ ฿{c.totalDebt.toFixed(0)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{
                                padding: '1rem',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: '#166534', marginBottom: '0.25rem' }}>ลูกค้าสมาชิก</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#15803d' }}>{selectedCustomer.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#166534' }}>{selectedCustomer.phone}</div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedCustomer(null)}
                                    style={{ background: 'white', borderColor: '#bbf7d0', color: '#15803d' }}
                                >
                                    เปลี่ยน
                                </Button>
                            </div>
                        )}

                        <Input
                            label="หมายเหตุ"
                            value={creditNote}
                            onChange={(e) => setCreditNote(e.target.value)}
                            placeholder="รายละเอียดเพิ่มเติม..."
                        />

                    </div>
                )}



                {/* Actions */}
                <div style={styles.actionsGrid}>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{ padding: '0', height: '70px', fontSize: '1.25rem' }}
                    >
                        ยกเลิก
                    </Button>

                    {method === 'cash' ? (
                        <Button
                            onClick={() => setCashReceived(total.toString())}
                            disabled={isProcessing}
                            style={{
                                padding: '0',
                                height: '70px',
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                background: '#f59e0b',
                                border: 'none',
                                color: 'white'
                            }}
                        >
                            พอดี
                        </Button>
                    ) : null}


                    <Button
                        onClick={handlePayment}
                        disabled={isProcessing || (method === 'cash' && change < 0) || (method === 'split' && splitTotal < total)}
                        icon={Check}
                        style={{
                            padding: '0',
                            height: '70px',
                            fontSize: '1.5rem',
                            fontWeight: '800',
                            gap: '12px',
                            background: (method === 'split' && splitTotal >= total) ? '#10b981' : undefined
                        }}
                    >
                        {isProcessing ? 'กำลังบันทึก...' : method === 'credit' ? 'ยืนยันบันทึกยอด' : method === 'split' ? `ยืนยัน (ทอน ฿${splitChange.toFixed(2)})` : 'ยืนยันชำระเงิน'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default PaymentModal;
