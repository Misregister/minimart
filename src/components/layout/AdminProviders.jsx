import React from 'react';
import { ShiftProvider } from '../../contexts/ShiftContext';
import { ProductProvider } from '../../contexts/ProductContext';
import { CartProvider } from '../../contexts/CartContext';
import { CustomerProvider } from '../../contexts/CustomerContext';

const AdminProviders = ({ children }) => (
    <ShiftProvider>
        <ProductProvider>
            <CartProvider>
                <CustomerProvider>
                    {children}
                </CustomerProvider>
            </CartProvider>
        </ProductProvider>
    </ShiftProvider>
);

export default AdminProviders;
