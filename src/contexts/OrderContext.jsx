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

    // Effect to fetch initial orders and set up real-time subscription
    useEffect(() => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        const fetchOrders = async () => {
            let allOrders = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .order('createdAt', { ascending: false })
                    .range(from, from + step - 1);
                
                if (error) {
                    console.error("Error fetching orders:", error);
                    hasMore = false;
                } else if (data) {
                    allOrders = [...allOrders, ...data];
                    if (data.length < step) {
                        hasMore = false;
                    } else {
                        from += step;
                    }
                } else {
                    hasMore = false;
                }
            }
            setOrders(allOrders);
            // Initial check for pending orders
            const hasPending = allOrders.some(order => order.status === 'pending');
            setPendingOrdersActive(hasPending);
            setLoading(false);
        };

        fetchOrders();

        // Real-time updates
        const channel = supabase
            .channel('orders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setOrders(prev => {
                        const updatedOrders = [payload.new, ...prev];
                        if (payload.new.status === 'pending') {
                            setPendingOrdersActive(true);
                            setNewOrderAlert(true);
                        }
                        return updatedOrders;
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setOrders(prev => {
                        const updated = prev.map(o => o.id === payload.new.id ? payload.new : o);
                        const hasPending = updated.some(order => order.status === 'pending');
                        setPendingOrdersActive(hasPending);
                        return updated;
                    });
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => {
                        const updatedOrders = prev.filter(o => o.id !== payload.old.id);
                        const hasPending = updatedOrders.some(order => order.status === 'pending');
                        setPendingOrdersActive(hasPending);
                        return updatedOrders;
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]); // Re-run if user changes (e.g., login/logout)

    // Effect to update pendingOrdersActive based on current orders state
    useEffect(() => {
        if (orders.length > 0) {
            const hasPending = orders.some(order => order.status === 'pending');
            setPendingOrdersActive(hasPending);
        } else {
            setPendingOrdersActive(false);
        }
    }, [orders]);


    const generateOrderNumber = () => {
        const date = new Date();
        const datePart = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;

        // Safely get today's orders count
        const todayStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const todayOrders = orders.filter(o => {
            const oDate = new Date(o.createdAt || new Date()).toLocaleDateString('en-CA');
            return oDate === todayStr;
        });

        const sequence = (todayOrders.length + 1).toString().padStart(4, '0');
        return `W-${datePart}-${sequence}`;
    };

    const createOrder = async (orderData) => {
        const date = new Date();
        const datePart = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const todayStart = new Date(date.setHours(0,0,0,0)).toISOString();
        const todayEnd = new Date(date.setHours(23,59,59,999)).toISOString();

        // Query today's count directly to handle cases where 'orders' state is empty (customer view)
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .gte('createdAt', todayStart)
            .lte('createdAt', todayEnd);

        const sequence = ( (count || 0) + 1).toString().padStart(4, '0');
        const customId = `W-${datePart}-${sequence}`;

        const newOrder = {
            ...orderData,
            id: customId,
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
