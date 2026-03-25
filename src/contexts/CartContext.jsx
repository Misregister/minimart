import React, { createContext, useContext, useState, useEffect } from 'react';
import { useShift } from './ShiftContext'; // Import ShiftContext

const CartContext = createContext(null);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const { isShiftOpen } = useShift(); // Consume ShiftContext
    const [cart, setCart] = useState([]);
    const [parkedCarts, setParkedCarts] = useState([]);
    const [lastPayment, setLastPayment] = useState(null); // { total, received, change }

    // Load from localStorage
    useEffect(() => {
        const storedCart = localStorage.getItem('pos_current_cart');
        const storedParked = localStorage.getItem('pos_parked_carts');

        if (storedCart) {
            try {
                const parsed = JSON.parse(storedCart);
                const validCart = Array.isArray(parsed)
                    ? parsed.filter(i => i && i.id && i.name)
                    : [];
                setCart(validCart);
            } catch (e) {
                console.error("Corrupt cart data", e);
                setCart([]);
            }
        }
        if (storedParked) {
            try {
                const parsed = JSON.parse(storedParked);
                setParkedCarts(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                setParkedCarts([]);
            }
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('pos_current_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('pos_parked_carts', JSON.stringify(parkedCarts));
    }, [parkedCarts]);

    useEffect(() => {
        if (lastPayment) {
            localStorage.setItem('pos_last_payment', JSON.stringify(lastPayment));
        } else {
            localStorage.removeItem('pos_last_payment');
        }
    }, [lastPayment]);

    // Calculate totals
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const tax = subtotal * 0; // 0% tax for now, can be configured
    const total = subtotal + tax;
    const itemCount = cart.reduce((count, item) => count + item.quantity, 0);

    const addToCart = React.useCallback((product, quantity = 1) => {
        if (!product || !product.id) {
            console.warn("Attempted to add invalid product to cart", product);
            return;
        }
        setCart(prev => {
            const existingItem = prev.find(item => item.id === product.id);
            if (existingItem) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
    }, []);

    const removeFromCart = React.useCallback((productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    }, []);

    const updateQuantity = React.useCallback((productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart(prev => prev.map(item =>
            item.id === productId ? { ...item, quantity } : item
        ));
    }, [removeFromCart]);

    const clearCart = React.useCallback(() => {
        setCart([]);
    }, []);

    // Auto-clear when shift closes
    useEffect(() => {
        if (!isShiftOpen) {
            setCart([]);
            setParkedCarts([]);
            setLastPayment(null);
        }
    }, [isShiftOpen]);

    const finishPayment = React.useCallback((receivedAmount) => {
        const change = receivedAmount - total;
        const paymentInfo = {
            total: total,
            received: receivedAmount,
            change: change,
            time: new Date().toISOString()
        };

        setLastPayment(paymentInfo);
        clearCart();

        // Clear display after 10 seconds
        setTimeout(() => {
            setLastPayment(prev =>
                (prev && prev.time === paymentInfo.time) ? null : prev
            );
        }, 10000);
    }, [total, clearCart]);

    const parkCurrentCart = React.useCallback(() => {
        if (cart.length === 0) return;

        const newParkedCart = {
            id: Date.now().toString(),
            time: new Date().toISOString(),
            items: [...cart],
            total: total
        };

        setParkedCarts(prev => [newParkedCart, ...prev]);
        clearCart();
    }, [cart, total, clearCart]);

    const resumeParkedCart = React.useCallback((parkedCartId) => {
        const target = parkedCarts.find(p => p.id === parkedCartId);
        if (target) {
            setCart(target.items);
            setParkedCarts(prev => prev.filter(p => p.id !== parkedCartId));
        }
    }, [parkedCarts]);

    const deleteParkedCart = React.useCallback((parkedCartId) => {
        setParkedCarts(prev => prev.filter(p => p.id !== parkedCartId));
    }, []);

    const value = React.useMemo(() => ({
        cart,
        parkedCarts,
        lastPayment,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        finishPayment,
        parkCurrentCart,
        resumeParkedCart,
        deleteParkedCart,
        subtotal,
        tax,
        total,
        itemCount
    }), [
        cart,
        parkedCarts,
        lastPayment,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        finishPayment,
        parkCurrentCart,
        resumeParkedCart,
        deleteParkedCart,
        subtotal,
        tax,
        total,
        itemCount
    ]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};
