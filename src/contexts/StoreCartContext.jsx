import React, { createContext, useContext, useState, useEffect } from 'react';

const StoreCartContext = createContext(null);

export const useStoreCart = () => {
    const context = useContext(StoreCartContext);
    if (!context) throw new Error('useStoreCart must be used within a StoreCartProvider');
    return context;
};

export const StoreCartProvider = ({ children }) => {
    const [cart, setCart] = useState([]);

    // Load from localStorage (Customer device)
    useEffect(() => {
        const storedCart = localStorage.getItem('store_cart');
        if (storedCart) {
            try {
                setCart(JSON.parse(storedCart));
            } catch (e) {
                console.error("Failed to parse store cart", e);
            }
        }
    }, []);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('store_cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            const currentQty = existing ? existing.quantity : 0;
            const maxLimit = 50; // Hard limit per item
            const stockLimit = product.stock || 0; // Physics limit

            // Calculate new total
            const newTotal = currentQty + quantity;

            // Check 1: Stock Limit
            if (newTotal > stockLimit) {
                // Return previous state (effectively doing nothing)
                // In a real app we might want to return an error, but context setters usually don't return values.
                // We'll rely on UI to check before calling, but this is a safety net.
                console.warn("Cannot add more than stock");
                return prev;
            }

            // Check 2: Hard Limit
            if (newTotal > maxLimit) {
                console.warn("Max limit per item reached");
                return prev;
            }

            if (existing) {
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: newTotal }
                        : item
                );
            }
            return [...prev, { ...product, quantity }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.quantity + delta;

                // 1. Min check
                if (newQty < 0) return item; // Should be handled by filter but just in case

                // 2. Max Limit Check (50)
                if (newQty > 50) return item;

                // 3. Stock Check (Need access to product stock here)
                // Since item in cart might be stale, we ideally need live product data.
                // But `item` in cart keeps a snapshot. 
                // We should probably rely on the `stock` property stored in cart item (snapshot)
                // or assume the caller checks.
                // For safety, let's use the snapshot stock.
                if (item.stock !== undefined && newQty > item.stock) {
                    return item;
                }

                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const clearCart = () => {
        setCart([]);
    };

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const value = {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice
    };

    return (
        <StoreCartContext.Provider value={value}>
            {children}
        </StoreCartContext.Provider>
    );
};
