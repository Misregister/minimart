import React, { useState } from 'react';
import { useCustomer } from '../contexts/CustomerContext';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import CustomerForm from '../components/customers/CustomerForm';
import { Search, Plus, Edit, Trash2, Users, FileText, Phone, DollarSign } from 'lucide-react';
import './Customers.css';

const Customers = () => {
    const { customers, deleteCustomer, repayDebt, addDebt } = useCustomer();
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [viewingHistory, setViewingHistory] = useState(null);
    const [payingCustomer, setPayingCustomer] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    // Manual Debt State
    const [addingDebtCustomer, setAddingDebtCustomer] = useState(null);
    const [debtAmount, setDebtAmount] = useState('');
    const [debtNote, setDebtNote] = useState('');

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm(t('deleteConfirm'))) {
            deleteCustomer(id);
        }
    };

    const handleAddNew = () => {
        setEditingCustomer(null);
        setIsFormOpen(true);
    };

    const handlePayment = () => {
        const amount = parseFloat(paymentAmount);
        if (amount > 0 && payingCustomer) {
            repayDebt(payingCustomer.id, amount);
            setPayingCustomer(null);
            setPaymentAmount('');
        }
    };

    const handleAddDebt = () => {
        const amount = parseFloat(debtAmount);
        if (amount > 0 && addingDebtCustomer) {
            addDebt(addingDebtCustomer.id, amount, debtNote || 'Manual Adjustment');
            setAddingDebtCustomer(null);
            setDebtAmount('');
            setDebtNote('');
        }
    };

    return (
        <div className="customers-container">
            <div className="customers-header">
                <div className="search-wrapper">
                    <Input
                        placeholder={t('searchProduct')}
                        icon={Search}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={handleAddNew} icon={Plus}>{t('addCustomer')}</Button>
            </div>

            <div className="customers-list">
                {filteredCustomers.length === 0 ? (
                    <div className="empty-state">
                        <Users size={48} />
                        <p>{t('noData')}</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="customers-table">
                            <thead>
                                <tr>
                                    <th>{t('name')}</th>
                                    <th>{t('phone')}</th>
                                    <th>{t('debtAmount')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(customer => (
                                    <tr key={customer.id}>
                                        <td>
                                            <div className="customer-name-cell">
                                                <div className="avatar">{customer.name.charAt(0)}</div>
                                                <div className="info">
                                                    <p className="font-medium">{customer.name}</p>
                                                    <p className="text-xs text-secondary">{customer.notes}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{customer.phone}</td>
                                        <td>
                                            <span className={`debt-badge ${customer.totalDebt > 0 ? 'has-debt' : ''}`}>
                                                ฿ {customer.totalDebt.toFixed(2)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <Button variant="ghost" size="sm" className="text-danger" onClick={() => { setAddingDebtCustomer(customer); setDebtAmount(''); setDebtNote(''); }} title="เพิ่มหนี้ (หนี้เก่า/อื่นๆ)">
                                                    <Plus size={16} />
                                                </Button>
                                                {customer.totalDebt > 0 && (
                                                    <Button variant="ghost" size="sm" className="text-success" onClick={() => { setPayingCustomer(customer); setPaymentAmount(''); }} title="ชำระหนี้">
                                                        <DollarSign size={16} />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => setViewingHistory(customer)} title={t('history')}>
                                                    <FileText size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(customer)}>
                                                    <Edit size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(customer.id)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingCustomer ? t('editCustomer') : t('addCustomer')}
                size="md"
            >
                <CustomerForm
                    customer={editingCustomer}
                    onClose={() => setIsFormOpen(false)}
                />
            </Modal>

            {/* History Modal */}
            <Modal
                isOpen={!!viewingHistory}
                onClose={() => setViewingHistory(null)}
                title={`${t('history')}: ${viewingHistory?.name}`}
                size="lg"
            >
                <div className="history-list">
                    {!viewingHistory?.history?.length ? (
                        <p className="text-muted text-center">{t('noHistory')}</p>
                    ) : (
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>{t('date')}</th>
                                    <th>{t('type')}</th>
                                    <th>{t('note')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...viewingHistory.history].reverse().map(item => (
                                    <tr key={item.id}>
                                        <td>{new Date(item.date).toLocaleString()}</td>
                                        <td>
                                            <span className={`type-badge ${item.type}`}>
                                                {item.type === 'credit' ? t('debtAdded') : t('paymentType')}
                                            </span>
                                        </td>
                                        <td>{item.ref || item.note}</td>
                                        <td style={{ textAlign: 'right', color: item.amount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                            {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Modal>

            {/* Payment Modal */}
            <Modal
                isOpen={!!payingCustomer}
                onClose={() => setPayingCustomer(null)}
                title={`ชำระหนี้: ${payingCustomer?.name}`}
                size="sm"
            >
                <div className="payment-form">
                    <div className="debt-display">
                        <p>ยอดหนี้คงค้าง</p>
                        <h2>฿ {payingCustomer?.totalDebt.toFixed(2)}</h2>
                    </div>
                    <div className="quick-amounts">
                        <button onClick={() => setPaymentAmount('50')}>50</button>
                        <button onClick={() => setPaymentAmount('100')}>100</button>
                        <button onClick={() => setPaymentAmount('500')}>500</button>
                        <button onClick={() => setPaymentAmount(payingCustomer?.totalDebt.toString())}>ทั้งหมด</button>
                    </div>
                    <Input
                        label="จำนวนเงิน"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="กรอกจำนวนเงินที่รับ"
                    />
                    <Button
                        size="lg"
                        onClick={handlePayment}
                        disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                        style={{ marginTop: '1rem', width: '100%' }}
                    >
                        ยืนยันการชำระ ฿ {paymentAmount || 0}
                    </Button>
                </div>
            </Modal>
            {/* Add Debt Modal */}
            <Modal
                isOpen={!!addingDebtCustomer}
                onClose={() => setAddingDebtCustomer(null)}
                title={`เพิ่มหนี้ (หนี้เก่า/อื่นๆ): ${addingDebtCustomer?.name}`}
                size="sm"
            >
                <div className="payment-form">
                    <Input
                        label="จำนวนเงิน"
                        type="number"
                        value={debtAmount}
                        onChange={(e) => setDebtAmount(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                    />
                    <Input
                        label="หมายเหตุ (ถ้ามี)"
                        value={debtNote}
                        onChange={(e) => setDebtNote(e.target.value)}
                        placeholder="เช่น หนี้เก่าก่อนใช้ระบบ"
                        style={{ marginTop: '1rem' }}
                    />
                    <Button
                        size="lg"
                        onClick={handleAddDebt}
                        disabled={!debtAmount || parseFloat(debtAmount) <= 0}
                        style={{ marginTop: '1.5rem', width: '100%', background: '#ef4444', border: 'none' }}
                        className="btn-danger"
                    >
                        ยืนยันเพิ่มหนี้ ฿ {debtAmount || 0}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default Customers;
