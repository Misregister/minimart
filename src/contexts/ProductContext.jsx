import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ProductContext = createContext(null);

// ============================================================
// 🚀 TURBO DATA ENGINE — IndexedDB + Parallel Fetch + Delta Sync
// ============================================================

const DB_NAME = 'minimart_db';
const DB_VERSION = 1;
const STORE_NAME = 'products';
const META_STORE = 'meta';

// ---- IndexedDB Helpers (much faster & bigger than sessionStorage) ----
const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

const idbGetAll = async () => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch { return []; }
};

const idbPutAll = async (products) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        // Use put (upsert) for each product
        products.forEach(p => {
            // Strip image from cache to save space
            const { image, ...slim } = p;
            store.put(slim);
        });
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch { return false; }
};

const idbDeleteIds = async (ids) => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach(id => store.delete(id));
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch { return false; }
};

const idbGetMeta = async (key) => {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(META_STORE, 'readonly');
            const req = tx.objectStore(META_STORE).get(key);
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
};

const idbSetMeta = async (key, value) => {
    try {
        const db = await openDB();
        const tx = db.transaction(META_STORE, 'readwrite');
        tx.objectStore(META_STORE).put({ key, value });
    } catch { /* ignore */ }
};

// ---- Fetch with retry ----
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await fetchFn();
            if (result.error) {
                const msg = result.error.message || '';
                if ((msg.includes('timeout') || msg.includes('fetch') || msg.includes('network') || msg.includes('502') || msg.includes('503')) && attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
                    console.warn(`[Turbo] ⏳ Retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }
            return result;
        } catch (err) {
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                continue;
            }
            return { data: null, error: err };
        }
    }
    return { data: null, error: { message: 'Max retries exceeded' } };
};

// Only essential columns — no image
const MAIN_COLUMNS = "id, name, barcode, price, cost, stock, category, unit, packSize, packPrice, minStock, zone, showInPOS, posIndex, packBarcode, caseBarcode, caseSize, casePrice, showInStore, isRecommended, isHero, updatedAt, createdAt, soldToday";

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
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const { user } = useAuth();
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!user) {
            setProducts([]);
            setLoading(false);
            setConnectionStatus('disconnected');
            return;
        }

        if (fetchedRef.current) return;
        fetchedRef.current = true;

        let cancelled = false;

        const turboLoad = async () => {
            const startTime = performance.now();

            // ============================================
            // PHASE 1: Instant load from IndexedDB cache
            // ============================================
            const cachedData = await idbGetAll();
            if (!cancelled && cachedData.length > 0) {
                setProducts(cachedData);
                setLoading(false);
                setConnectionStatus('cached');
                console.log(`[Turbo] ⚡ ${cachedData.length} products from IndexedDB in ${(performance.now() - startTime).toFixed(0)}ms`);
            }

            // ============================================
            // PHASE 2: Delta Sync (only fetch what changed)
            // ============================================
            const lastSync = await idbGetMeta('lastSyncTime');
            
            if (lastSync && cachedData.length > 0) {
                // INCREMENTAL: Only fetch products updated since last sync
                setConnectionStatus('syncing');
                try {
                    const { data: changed, error } = await fetchWithRetry(() =>
                        supabase
                            .from('products')
                            .select(MAIN_COLUMNS)
                            .gt('updatedAt', lastSync)
                            .order('name')
                            .limit(1000)
                    );

                    if (cancelled) return;

                    if (!error && changed) {
                        if (changed.length > 0) {
                            // Merge changed products into cached data
                            const changedMap = Object.fromEntries(changed.map(p => [p.id, p]));
                            const merged = cachedData.map(p => changedMap[p.id] ? { ...p, ...changedMap[p.id] } : p);
                            
                            // Add any new products not in cache
                            const cachedIds = new Set(cachedData.map(p => p.id));
                            const newProducts = changed.filter(p => !cachedIds.has(p.id));
                            const final = [...merged, ...newProducts];
                            
                            setProducts(final);
                            await idbPutAll(changed);
                            console.log(`[Turbo] 🔄 Delta sync: ${changed.length} changed, ${newProducts.length} new`);
                        } else {
                            console.log(`[Turbo] ✅ No changes since last sync`);
                        }
                        
                        await idbSetMeta('lastSyncTime', new Date().toISOString());
                        setConnectionStatus('connected');
                        setLoading(false);

                        // Still verify total count matches to detect deletes
                        const { count } = await supabase
                            .from('products')
                            .select('*', { count: 'exact', head: true });
                        
                        if (count !== null && count !== cachedData.length + (changed?.filter(p => !new Set(cachedData.map(x => x.id)).has(p.id)).length || 0)) {
                            console.log(`[Turbo] ⚠️ Count mismatch (server: ${count}, local: ${cachedData.length}), doing full refresh...`);
                            await fullParallelFetch(cancelled);
                        }
                        
                        // Fetch images in background
                        await fetchImages(products);
                        return;
                    }
                } catch (err) {
                    console.warn('[Turbo] Delta sync failed, falling back to full fetch:', err.message);
                }
            }

            // ============================================
            // PHASE 3: Full Parallel Fetch (first load or fallback)
            // ============================================
            await fullParallelFetch(cancelled);
        };

        const fullParallelFetch = async (cancelled) => {
            const startTime = performance.now();
            if (products.length === 0) setLoading(true);
            setConnectionStatus('connecting');

            try {
                // Step 1: Get total count (single HEAD request — super fast)
                const { count, error: countError } = await fetchWithRetry(() =>
                    supabase
                        .from('products')
                        .select('*', { count: 'exact', head: true })
                );

                if (cancelled) return;
                
                if (countError || count === null || count === 0) {
                    if (count === 0) {
                        setProducts([]);
                        setConnectionStatus('connected');
                        setLoading(false);
                        return;
                    }
                    console.error('[Turbo] ❌ Count query failed:', countError?.message);
                    setConnectionStatus('error');
                    setLoading(false);
                    return;
                }

                console.log(`[Turbo] 📊 Total products: ${count}, fetching ALL in parallel...`);
                setConnectionStatus('syncing');

                // Step 2: Fire ALL batch requests in parallel! 🚀
                const BATCH = 500;
                const batchPromises = [];
                for (let from = 0; from < count; from += BATCH) {
                    const batchFrom = from;
                    batchPromises.push(
                        fetchWithRetry(() =>
                            supabase
                                .from('products')
                                .select(MAIN_COLUMNS)
                                .order('name')
                                .range(batchFrom, batchFrom + BATCH - 1)
                        , 2)
                    );
                }

                const results = await Promise.allSettled(batchPromises);
                if (cancelled) return;

                // Merge all results
                let allProducts = [];
                let anyFailed = false;
                results.forEach((result, i) => {
                    if (result.status === 'fulfilled' && result.value.data) {
                        allProducts = [...allProducts, ...result.value.data];
                    } else {
                        anyFailed = true;
                        console.error(`[Turbo] ❌ Batch ${i} failed`);
                    }
                });

                const elapsed = (performance.now() - startTime).toFixed(0);

                if (allProducts.length > 0) {
                    setProducts(allProducts);
                    setConnectionStatus(anyFailed ? 'cached' : 'connected');
                    console.log(`[Turbo] 🚀 Loaded ${allProducts.length} products in ${elapsed}ms (${batchPromises.length} parallel batches)`);

                    // Save to IndexedDB in background
                    idbPutAll(allProducts).then(() => {
                        idbSetMeta('lastSyncTime', new Date().toISOString());
                        console.log('[Turbo] 💾 Saved to IndexedDB');
                    });
                } else {
                    setConnectionStatus('error');
                }
            } catch (err) {
                console.error('[Turbo] 💥 Full fetch error:', err);
                setConnectionStatus('error');
            } finally {
                if (!cancelled) setLoading(false);
            }

            // Fetch images
            await fetchImages();
        };

        const fetchImages = async () => {
            if (cancelled) return;
            
            // Get current products from state
            const currentProducts = await new Promise(resolve => {
                setProducts(prev => {
                    resolve(prev);
                    return prev;
                });
            });

            const mediaIds = currentProducts.filter(p => p.showInPOS || p.showInStore).map(p => p.id);
            if (mediaIds.length === 0) return;

            const CHUNK = 50;
            const promises = [];
            for (let i = 0; i < mediaIds.length; i += CHUNK) {
                promises.push(
                    fetchWithRetry(() =>
                        supabase
                            .from('products')
                            .select('id, image')
                            .in('id', mediaIds.slice(i, i + CHUNK))
                            .not('image', 'is', null)
                    , 1)
                );
            }

            try {
                const results = await Promise.allSettled(promises);
                if (cancelled) return;
                const allImages = {};
                results.forEach(r => {
                    if (r.status === 'fulfilled' && r.value.data) {
                        r.value.data.forEach(img => { allImages[img.id] = img.image; });
                    }
                });
                if (Object.keys(allImages).length > 0) {
                    setProducts(prev => prev.map(p => allImages[p.id] ? { ...p, image: allImages[p.id] } : p));
                    console.log(`[Turbo] 🖼️ ${Object.keys(allImages).length} images loaded`);
                }
            } catch { /* ignore */ }
        };

        turboLoad();

        // Real-time updates (also update IndexedDB)
        const channel = supabase
            .channel('products_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setProducts(prev => [...prev, payload.new]);
                    idbPutAll([payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setProducts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
                    idbPutAll([payload.new]);
                } else if (payload.eventType === 'DELETE') {
                    setProducts(prev => prev.filter(p => p.id !== payload.old.id));
                    idbDeleteIds([payload.old.id]);
                }
            })
            .subscribe();

        return () => {
            cancelled = true;
            fetchedRef.current = false;
            supabase.removeChannel(channel);
        };
    }, [user]);

    const addProduct = React.useCallback(async (productData) => {
        const { id, barcode, ...data } = productData;
        const trimmedBarcode = barcode ? String(barcode).trim() : '';

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
        if (updatedData.price !== undefined) {
             const oldProduct = products.find(p => p.id === id);
             if (oldProduct && Number(oldProduct.price) !== Number(updatedData.price)) {
                  supabase.from('price_history').insert({
                      productId: id,
                      oldPrice: oldProduct.price,
                      newPrice: updatedData.price,
                      updatedAt: new Date().toISOString()
                  }).then(() => {});
             }
        }

        const { error } = await supabase
            .from('products')
            .update(updatedData)
            .eq('id', id);
        if (error) throw error;
    }, [products]);

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
            soldToday: newSold,
            lastSoldAt: new Date().toISOString()
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

    const recordWaste = React.useCallback(async (wasteData) => {
        const { error } = await supabase
            .from('waste_logs')
            .insert({ ...wasteData, createdAt: new Date().toISOString() });
        if (error) throw error;
    }, []);

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
        const { error } = await supabase.from('products').upsert(orderedItems);
        if (error) throw error;
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
        connectionStatus,
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
        resetShowInStore,
        recordWaste
    }), [
        products, loading, connectionStatus, getProductByBarcode, addProduct, updateProduct, deleteProduct,
        addStock, deductStock, withdrawStock, resetProductSales, clearAllProducts,
        resetAllProductVisibility, updateProductOrder, bulkUpdateVisibilityByImage,
        bulkAutoCategorize, resetShowInStore, recordWaste
    ]);

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
