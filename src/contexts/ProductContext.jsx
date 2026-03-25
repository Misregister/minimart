import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ProductContext = createContext(null);

export const useProduct = () => {
    const context = useContext(ProductContext);
    if (!context) {
        throw new Error('useProduct must be used within a ProductProvider');
    }
    return context;
};

export const ProductProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            setProducts([]);
            setLoading(false);
            return;
        }

        const fetchProducts = async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
            
            if (error) {
                console.error("Supabase fetch error:", error);
            } else {
                setProducts(data || []);
            }
            setLoading(false);
        };

        fetchProducts();

        // Real-time updates
        const channel = supabase
            .channel('products_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setProducts(prev => [...prev, payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
                } else if (payload.eventType === 'DELETE') {
                    setProducts(prev => prev.filter(p => p.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const addProduct = React.useCallback(async (productData) => {
        const { id, barcode, ...data } = productData;
        const trimmedBarcode = barcode ? String(barcode).trim() : '';

        // 1. Try to find existing product by Barcode if no ID
        let existingId = id;
        if (!existingId && trimmedBarcode) {
            const existing = products.find(p => String(p.barcode).trim() === trimmedBarcode);
            if (existing) existingId = existing.id;
        }

        const finalData = {
            ...data,
            barcode: trimmedBarcode,
            updatedAt: new Date().toISOString(),
            showInPOS: data.showInPOS !== undefined ? data.showInPOS : false,
            showInStore: data.showInStore !== undefined ? data.showInStore : false
        };

        if (existingId) {
            const { data: updated, error } = await supabase
                .from('products')
                .update(finalData)
                .eq('id', existingId)
                .select()
                .single();
            if (error) throw error;
            return updated;
        } else {
            const { data: created, error } = await supabase
                .from('products')
                .insert({ ...finalData, createdAt: new Date().toISOString() })
                .select()
                .single();
            if (error) throw error;
            return created;
        }
    }, [products]);

    const updateProduct = React.useCallback(async (id, updatedData) => {
        const { error } = await supabase
            .from('products')
            .update(updatedData)
            .eq('id', id);
        if (error) throw error;
    }, []);

    const deleteProduct = React.useCallback(async (id) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }, []);

    const addStock = React.useCallback(async (productId, amount, unitType = 'unit', newCostPrice = null) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        let multiplier = 1;
        if (unitType === 'pack') multiplier = product.packSize || 1;
        if (unitType === 'case') multiplier = product.caseSize || 1;

        const addAmount = parseFloat(amount) * multiplier;
        const newStock = (parseFloat(product.stock) || 0) + addAmount;

        const updateData = { stock: newStock };
        if (newCostPrice !== null && newCostPrice > 0) {
            updateData.cost = parseFloat(newCostPrice);
        }

        await updateProduct(productId, updateData);
    }, [products, updateProduct]);

    const deductStock = React.useCallback(async (productId, amount) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const deductAmount = parseFloat(amount || 0);
        const newStock = (parseFloat(product.stock) || 0) - deductAmount;
        const newSold = (parseFloat(product.soldToday) || 0) + deductAmount;

        await updateProduct(productId, {
            stock: newStock,
            soldToday: newSold
        });
    }, [products, updateProduct]);

    const withdrawStock = React.useCallback(async (productId, amount) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        await updateProduct(productId, { stock: (parseFloat(product.stock) || 0) - amount });
    }, [products, updateProduct]);

    const resetProductSales = React.useCallback(async (productId) => {
        await updateProduct(productId, { soldToday: 0 });
    }, [updateProduct]);

    const clearAllProducts = React.useCallback(async () => {
        const { error } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }, []);

    const resetAllProductVisibility = React.useCallback(async () => {
        const { error } = await supabase.from('products').update({ showInPOS: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
    }, []);

    const resetShowInStore = React.useCallback(async () => {
        const { data, error } = await supabase
            .from('products')
            .update({ showInStore: false })
            .eq('showInStore', true)
            .select();
        if (error) throw error;
        return data.length;
    }, []);

    const updateProductOrder = React.useCallback(async (orderedItems) => {
        for (const item of orderedItems) {
            await supabase.from('products').update({ posIndex: item.posIndex }).eq('id', item.id);
        }
    }, []);

    const bulkUpdateVisibilityByImage = React.useCallback(async () => {
        const idsToUpdate = products.filter(p => p.image).map(p => p.id);
        if (idsToUpdate.length === 0) return 0;

        const { error } = await supabase
            .from('products')
            .update({ showInStore: true, isRecommended: true })
            .in('id', idsToUpdate);
        
        if (error) throw error;
        return idsToUpdate.length;
    }, [products]);

    const bulkAutoCategorize = React.useCallback(async () => {
        const rules = [
            { cat: 'แอลกอฮอร์และบุหรี่', keys: ['เบียร์', 'เหล้า', 'บุหรี่', 'ช้าง', 'สิงห์', 'ลีโอ', 'ยาเส้น', 'Spy', 'Regency', 'Blend', 'Hongthong', 'SangSom', 'ยาแผง'] },
            { cat: 'ขนมและลูกอม', keys: ['ขนม', 'ลูกอม', 'เลย์', 'เทสโต้', 'ปาปริก้า', 'คุกกี้', 'เวเฟอร์', 'เยลลี่', 'ยูโร', 'ทิวลี่', 'ฟันโอ', 'ป๊อกกี้', 'บิสกิต', 'โก๋แก่'] },
            { cat: 'เครื่องดื่ม', keys: ['น้ำเปล่า', 'โซดา', 'โค้ก', 'เป๊ปซี่', 'สไปรท์', 'โออิชิ', 'อิชิตัน', 'กาแฟ', 'เนสกาแฟ', 'ชา', 'สปอนเซอร์', 'กระทิงแดง', 'M-150', 'คาราบาว', 'เครื่องดื่ม'] },
            { cat: 'นมและโยเกิร์ต', keys: ['นม', 'โยเกิร์ต', 'แลคตาซอย', 'ดีน่า', 'ไวตามิ้ลค์', 'ดัชมิลล์', 'โฟร์โมสต์', 'ไทยเดนมาร์ค', 'นมกล่อง', 'ทิปโก้'] },
            { cat: 'สุขภาพและความงาม', keys: ['สบู่', 'แชมพู', 'ยาสีฟัน', 'แป้งตรางู', 'แป้งเย็น', 'ครีม', 'ผ้าอนามัย', 'ลอรีอัล', 'ซันซิล', 'แพนทีน', 'แป้งฝุ่น', 'น้ำหอม'] },
            { cat: 'ของใช้ในครัวเรือน', keys: ['ผงซักฟอก', 'บรีส', 'โอโม', 'น้ำยาล้างจาน', 'ซันไลต์', 'ทิชชู่', 'ถุงขยะ', 'ถ่าน', 'ไฟแช็ก', 'ยากันยุง', 'สแลค', 'เป็ด'] },
            { cat: 'ครัวและเครื่องปรุงรส', keys: ['น้ำปลา', 'รสดี', 'ซีอิ๊ว', 'ซอส', 'เกลือ', 'น้ำตาล', 'ชูรส', 'อายิโนโมโตะ', 'ปลากระป๋อง', 'น้ำมันพืช', 'มะนาว', 'กะปิ', 'คนอร์'] },
            { cat: 'อาหารแห้ง', keys: ['มาม่า', 'ไวไว', 'ยำยำ', 'ข้าวสาร', 'บะหมี่', 'โจ๊ก', 'คัพนู้ดเดิล', 'อาหารแห้ง'] },
            { cat: 'ของเล่นและเครื่องเขียน', keys: ['สมุด', 'ปากกา', 'ดินสอ', 'ยางลบ', 'ของเล่น', 'สี', 'กระดาษ', 'กรรไกร', 'สีน้ำ'] },
            { cat: 'สัตว์เลี้ยง', keys: ['สุนัข', 'แมว', 'อาหารหมา', 'อาหารแมว', 'วิสกัส', 'เพดดิกรี', 'ทูน่าแมว'] },
            { cat: 'ยาสามัญประจำบ้าน', keys: ['ยา', 'พารา', 'ยาหม่อง', 'พลาสเตอร์', 'ยาธาตุ', 'วิคส์'] }
        ];

        let updateCount = 0;
        for (const p of products) {
            const name = p.name.toLowerCase();
            for (const rule of rules) {
                if (rule.keys.some(k => name.includes(k.toLowerCase()))) {
                    if (p.category !== rule.cat) {
                        await updateProduct(p.id, { category: rule.cat });
                        updateCount++;
                    }
                    break;
                }
            }
        }
        return updateCount;
    }, [products, updateProduct]);

    const getProductByBarcode = React.useCallback((barcode) => {
        if (!products || !Array.isArray(products)) return undefined;
        const cleanCode = String(barcode).trim().toLowerCase();
        const isMatch = (dbCode) => {
            if (!dbCode) return false;
            const cleanDb = String(dbCode).trim().toLowerCase();
            return cleanDb === cleanCode || cleanDb === `0${cleanCode}` || `0${cleanDb}` === cleanCode;
        };

        const unitMatch = products.find(p => p && isMatch(p.barcode));
        if (unitMatch) return { product: unitMatch, type: 'unit' };

        const packMatch = products.find(p => p && isMatch(p.packBarcode));
        if (packMatch) return { product: packMatch, type: 'pack' };

        const caseMatch = products.find(p => p && isMatch(p.caseBarcode));
        if (caseMatch) return { product: caseMatch, type: 'case' };

        return undefined;
    }, [products]);

    const value = React.useMemo(() => ({
        products,
        loading,
        getProductByBarcode,
        addProduct,
        updateProduct,
        deleteProduct,
        addStock,
        deductStock,
        withdrawStock,
        resetProductSales,
        clearAllProducts,
        resetAllProductVisibility,
        updateProductOrder,
        bulkUpdateVisibilityByImage,
        bulkAutoCategorize,
        resetShowInStore
    }), [
        products, loading, getProductByBarcode, addProduct, updateProduct, deleteProduct,
        addStock, deductStock, withdrawStock, resetProductSales, clearAllProducts,
        resetAllProductVisibility, updateProductOrder, bulkUpdateVisibilityByImage,
        bulkAutoCategorize, resetShowInStore
    ]);

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
