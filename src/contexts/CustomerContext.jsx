import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const CustomerContext = createContext(null);

export const useCustomer = () => {
    const context = useContext(CustomerContext);
    if (!context) {
        throw new Error('useCustomer must be used within a CustomerProvider');
    }
    return context;
};

export const CustomerProvider = ({ children }) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial Data Load & Real-time Listener
    useEffect(() => {
        const fetchCustomers = async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name');
            
            if (error) {
                console.error("Error fetching customers:", error);
            } else {
                setCustomers(data || []);
            }
            setLoading(false);
        };

        fetchCustomers();

        // Real-time updates
        const channel = supabase
            .channel('customers_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setCustomers(prev => [...prev, payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setCustomers(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
                } else if (payload.eventType === 'DELETE') {
                    setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addCustomer = async (customerData) => {
        try {
            const newCustomer = {
                ...customerData,
                totalDebt: 0,
                history: [],
                createdAt: new Date().toISOString()
            };
            const { data, error } = await supabase
                .from('customers')
                .insert(newCustomer)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error adding customer:", error);
            throw error;
        }
    };

    const updateCustomer = async (id, data) => {
        const { error } = await supabase
            .from('customers')
            .update(data)
            .eq('id', id);
        if (error) {
            console.error("Error updating customer:", error);
            throw error;
        }
    };

    const deleteCustomer = async (id) => {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);
        if (error) {
            console.error("Error deleting customer:", error);
            throw error;
        }
    };

    const addDebt = async (customerId, amount, note) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newHistoryItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            amount: amount,
            type: 'credit',
            ref: note || 'Manual Adjustment'
        };

        const updatedHistory = [...(customer.history || []), newHistoryItem];
        const newDebt = (customer.totalDebt || 0) + amount;

        await updateCustomer(customerId, {
            totalDebt: newDebt,
            history: updatedHistory
        });
    };

    const repayDebt = async (customerId, amount) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newHistoryItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            amount: -amount,
            type: 'payment',
            ref: 'Manual Repayment'
        };

        const updatedHistory = [...(customer.history || []), newHistoryItem];
        const newDebt = Math.max(0, (customer.totalDebt || 0) - amount);

        await updateCustomer(customerId, {
            totalDebt: newDebt,
            history: updatedHistory
        });
    };

    const removeDebt = async (customerId, amount, refId) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newHistoryItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            amount: -amount,
            type: 'void',
            ref: `VOID: ${refId}`
        };

        const updatedHistory = [...(customer.history || []), newHistoryItem];
        const newDebt = Math.max(0, (customer.totalDebt || 0) - amount);

        await updateCustomer(customerId, {
            totalDebt: newDebt,
            history: updatedHistory
        });
    };

    const value = {
        customers,
        loading,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addDebt,
        removeDebt,
        repayDebt
    };

    return (
        <CustomerContext.Provider value={value}>
            {children}
        </CustomerContext.Provider>
    );
};
