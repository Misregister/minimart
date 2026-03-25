import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

const OrderContext = createContext(null);

export const useOrder = () => {
    const context = useContext(OrderContext);
    if (!context) throw new Error('useOrder must be used within an OrderProvider');
    return context;
};

export const OrderProvider = ({ children }) => {
    const [pendingOrdersActive, setPendingOrdersActive] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const { user } = useAuth();

    // Subscribe to orders table (Only if authenticated)
    useEffect(() => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        const fetchOrders = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('createdAt', { ascending: false });
            
            if (error) {
                console.error("Error fetching orders:", error);
            } else {
                setOrders(data || []);
                const hasPending = (data || []).some(order => order.status === 'pending');
                setPendingOrdersActive(hasPending);
            }
            setLoading(false);
        };

        fetchOrders();

        // Real-time updates
        const channel = supabase
            .channel('orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setOrders(prev => [payload.new, ...prev]);
                    if (payload.new.status === 'pending') {
                        setPendingOrdersActive(true);
                        setNewOrderAlert(true);
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setOrders(prev => {
                        const updated = prev.map(o => o.id === payload.new.id ? payload.new : o);
                        const hasPending = updated.some(order => order.status === 'pending');
                        setPendingOrdersActive(hasPending);
                        return updated;
                    });
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(o => o.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const createOrder = async (orderData) => {
        // Generate a readable ID: W-YYMMDD-XXXX (Supabase uses UUID by default but we can keep custom ID for readable tracking if needed)
        // However, for Supabase we can just insert and let it handle ID or use our own.
        // I'll keep the readable ID as a property if needed, but Supabase ID is primary.
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const customId = `W-${dateStr}-${randomStr}`;

        const newOrder = {
            ...orderData,
            id: customId, // Using the custom ID as PK
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            paymentStatus: orderData.paymentMethod === 'cod' ? 'pending' : 'pending_verification'
        };

        try {
            const { data, error } = await supabase
                .from('orders')
                .insert(newOrder)
                .select()
                .single();

            if (error) throw error;
            setNewOrderAlert(true);
            return data;
        } catch (error) {
            console.error("Error creating order:", error);
            throw error;
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    status: newStatus,
                    updatedAt: new Date().toISOString()
                })
                .eq('id', orderId);
            
            if (error) throw error;
        } catch (error) {
            console.error("Error updating order status:", error);
            throw error;
        }
    };

    const acknowledgeNewOrder = () => {
        setNewOrderAlert(false);
    };

    const deleteOrder = async (orderId) => {
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);
            
            if (error) throw error;
        } catch (error) {
            console.error("Error deleting order:", error);
            throw error;
        }
    };

    const value = {
        orders,
        loading,
        newOrderAlert,
        pendingOrdersActive,
        createOrder,
        updateOrderStatus,
        acknowledgeNewOrder,
        deleteOrder
    };

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
};
