import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ShiftContext = createContext(null);

export const useShift = () => {
    const context = useContext(ShiftContext);
    if (!context) {
        throw new Error('useShift must be used within a ShiftProvider');
    }
    return context;
};

export const ShiftProvider = ({ children }) => {
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftHistory, setShiftHistory] = useState([]);
    const [globalTransactions, setGlobalTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchShifts = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .order('startTime', { ascending: false });
        
        if (error) {
            console.error("Error fetching shifts:", error);
        } else {
            const active = data.find(s => s.status === 'open');
            setCurrentShift(active || null);
            setShiftHistory(data.filter(s => s.status === 'closed'));
            
            // Build Global Transactions
            const allTxs = data.flatMap(s => s.transactions || [])
                .sort((a, b) => new Date(b.time) - new Date(a.time));
            setGlobalTransactions(allTxs);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!user) {
            setCurrentShift(null);
            setShiftHistory([]);
            setLoading(false);
            return;
        }

        fetchShifts();

        const channel = supabase
            .channel('shifts_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
                fetchShifts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const openShift = async (startCash) => {
        if (currentShift) return;
        const newShift = {
            startTime: new Date().toISOString(),
            startCash: parseFloat(startCash),
            status: 'open',
            sales: 0,
            expenses: 0,
            transactions: [],
            productSales: {}
        };
        const { data, error } = await supabase.from('shifts').insert(newShift).select().single();
        if (error) throw error;
        setCurrentShift(data);
    };

    const closeShift = async (actualCash, note = '') => {
        if (!currentShift) return;
        const { error } = await supabase
            .from('shifts')
            .update({
                status: 'closed',
                endTime: new Date().toISOString(),
                actualCash: parseFloat(actualCash),
                note
            })
            .eq('id', currentShift.id);
        if (error) throw error;
        localStorage.removeItem('pos_current_cart');
        localStorage.removeItem('pos_parked_carts');
        setTimeout(() => window.location.reload(), 500);
    };

    const recordTransaction = async (params) => {
        if (!currentShift) return;
        const newTx = {
            id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 5),
            shiftId: currentShift.id,
            time: new Date().toISOString(),
            amount: parseFloat(params.total || params.amount || 0),
            items: params.items || [],
            method: params.paymentMethod || params.method || 'cash',
            payments: params.payments || [],
            customerId: params.customerId || null,
            customerName: params.customerName || null,
            note: params.note || null,
            change: parseFloat(params.change || 0),
            cashReceived: parseFloat(params.cashReceived || 0),
            status: 'completed',
            type: 'sale'
        };
        const updatedTxs = [newTx, ...(currentShift.transactions || [])];
        const newSales = (parseFloat(currentShift.sales) || 0) + newTx.amount;
        const updatedProductSales = { ...(currentShift.productSales || {}) };
        newTx.items.forEach(item => {
            const id = String(item.id).replace(/\./g, '_');
            updatedProductSales[id] = (updatedProductSales[id] || 0) + (parseFloat(item.quantity) || 0);
        });
        const { error } = await supabase
            .from('shifts')
            .update({ transactions: updatedTxs, sales: newSales, productSales: updatedProductSales })
            .eq('id', currentShift.id);
        if (error) throw error;
        return newTx;
    };

    const recordWithdrawal = async (items = [], reason = 'owner_consume', note = '') => {
        if (!currentShift) return;
        const newTx = {
            id: 'wd_' + Date.now(),
            time: new Date().toISOString(),
            amount: 0,
            items,
            method: 'withdraw',
            status: 'completed',
            reason,
            note,
            type: 'withdrawal'
        };
        const updatedTxs = [newTx, ...(currentShift.transactions || [])];
        await supabase.from('shifts').update({ transactions: updatedTxs }).eq('id', currentShift.id);
    };

    const recordExpense = async (amount, category = 'general', note = '') => {
        if (!currentShift) return;
        const newTx = {
            id: 'ex_' + Date.now(),
            time: new Date().toISOString(),
            amount: parseFloat(amount),
            type: 'expense',
            category,
            note,
            status: 'completed'
        };
        const updatedTxs = [newTx, ...(currentShift.transactions || [])];
        const newExpenses = (parseFloat(currentShift.expenses) || 0) + newTx.amount;
        await supabase.from('shifts').update({ transactions: updatedTxs, expenses: newExpenses }).eq('id', currentShift.id);
    };

    const voidTransaction = async (transactionId, shiftId = null) => {
        const targetId = shiftId || currentShift?.id;
        if (!targetId) return;
        const { data: shift } = await supabase.from('shifts').select('*').eq('id', targetId).single();
        if (!shift) return;
        const txIndex = shift.transactions.findIndex(t => t.id === transactionId);
        if (txIndex === -1) return;
        const tx = shift.transactions[txIndex];
        if (tx.status === 'voided') return;
        const updatedTxs = [...shift.transactions];
        updatedTxs[txIndex] = { ...tx, status: 'voided', voidedAt: new Date().toISOString() };
        const updateData = { transactions: updatedTxs };
        if (tx.type === 'sale') {
            updateData.sales = (parseFloat(shift.sales) || 0) - tx.amount;
            const updatedPS = { ...shift.productSales };
            (tx.items || []).forEach(item => {
                const id = String(item.id).replace(/\./g, '_');
                if (updatedPS[id]) updatedPS[id] -= item.quantity;
            });
            updateData.productSales = updatedPS;
        } else if (tx.type === 'expense') {
            updateData.expenses = (parseFloat(shift.expenses) || 0) - tx.amount;
        }
        await supabase.from('shifts').update(updateData).eq('id', targetId);
    };

    const getSoldToday = (productId) => {
        if (!currentShift || !currentShift.productSales) return 0;
        const key = String(productId).replace(/\./g, '_');
        return currentShift.productSales[key] || 0;
    };

    const deleteShift = async (shiftId) => {
        await supabase.from('shifts').delete().eq('id', shiftId);
    };

    const exportShiftHistory = () => {
        if (shiftHistory.length === 0) return;
        let csv = "Shift ID,Start Time,End Time,Sales,Expenses,Actual Cash,Note\n";
        shiftHistory.forEach(s => {
            csv += `${s.id},${s.startTime},${s.endTime || '-'},${s.sales},${s.expenses},${s.actualCash || '-'},${s.note || '-'}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift_history_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const value = {
        currentShift,
        currentTransactions: currentShift?.transactions || [],
        globalTransactions,
        shiftHistory,
        isShiftOpen: !!currentShift && currentShift.status === 'open',
        openShift,
        closeShift,
        recordTransaction,
        recordWithdrawal,
        recordExpense,
        voidTransaction,
        getSoldToday,
        deleteShift,
        exportShiftHistory
    };

    return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
};
