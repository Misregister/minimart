import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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

// Core columns for POS/Store - image included for instant visuals
const MAIN_COLUMNS = "id, name, barcode, price, cost, stock, category, unit, image, packSize, packPrice, minStock, zone, showInPOS, posIndex, packBarcode, caseBarcode, caseSize, casePrice, showInStore, isRecommended, isHero, updatedAt, createdAt, soldToday";

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

    // ============================================
    // ⚡ SUPER FAST O(1) LOOKUP MAPS
    // ============================================
    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach(p => map.set(p.id, p));
        return map;
    }, [products]);

    const barcodeMap = useMemo(() => {
        const map = new Map();
        products.forEach(p => {
            if (p.barcode) map.set(String(p.barcode).trim().toLowerCase(), { product: p, type: 'unit' });
            if (p.packBarcode) map.set(String(p.packBarcode).trim().toLowerCase(), { product: p, type: 'pack' });
            if (p.caseBarcode) map.set(String(p.caseBarcode).trim().toLowerCase(), { product: p, type: 'case' });
        });
        return map;
    }, [products]);

    useEffect(() => {
        // We now allow loading even if !user for the Storefront (Guest access)
        // Sensitive operations like addProduct/updateProduct should still check for auth or RLS
        
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
                        
                        if (count !== null && count !== products.length) {
                             // Just log mismatch, full parallel fetch handles deletes or missing items
                             console.log(`[Turbo] ⚠️ Count mismatch (server: ${count}, local: ${products.length}), doing full refresh...`);
                             await fullParallelFetch(cancelled);
                        } else {
                            // Fetch images in background
                            await fetchImages();
                        }
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
            setConnectionStatus('connecting');

            try {
                // Step 1: Get total count (single HEAD request — super fast)
                const { count, error: countError } = await fetchWithRetry(() =>
                    supabase
                        .from('products')
                        .select('*', { count: 'exact', head: true })
                );

                if (cancelled) return;
                
                if (countError || count === null) {
                    console.error('[Turbo] ❌ Count query failed:', countError?.message);
                    setConnectionStatus('error');
                    setLoading(false);
                    return;
                }

                if (count === 0) {
                    setProducts([]);
                    setConnectionStatus('connected');
                    setLoading(false);
                    return;
                }

                console.log(`[Turbo] 📊 Total products: ${count}, fetching ALL in parallel...`);
                setConnectionStatus('syncing');

                // Step 2: Fire ALL batch requests in parallel! 🚀
                // PRIORITY 1: Fetch all "Active" products for POS and Storefront (Instant UI)
                console.log(`[Turbo] 🎯 Fetching Active POS & Storefront products first...`);
                const { data: activeProducts, error: activeError } = await fetchWithRetry(() =>
                    supabase
                        .from('products')
                        .select(MAIN_COLUMNS)
                        .or('showInPOS.eq.true,showInStore.eq.true,showInPOS.is.null')
                        .order('name')
                );

                if (!activeError && activeProducts && !cancelled) {
                    setProducts(activeProducts);
                    setLoading(false); // Stop full-page loader once active items are ready
                    setConnectionStatus('syncing');
                    console.log(`[Turbo] ✅ Active products ready: ${activeProducts.length} items`);
                }

                // PRIORITY 2: Fetch the rest of the inventory (Hidden/Inactive) in parallel batches
                const BATCH = 500;
                const batchPromises = [];
                for (let from = 0; from < count; from += BATCH) {
                    const batchFrom = from;
                    const promise = fetchWithRetry(() =>
                        supabase
                            .from('products')
                            .select(MAIN_COLUMNS)
                            .order('name')
                            .range(batchFrom, batchFrom + BATCH - 1)
                    , 2).then(res => {
                        if (res.data && !cancelled) {
                            // PROGRESSIVE LOAD: Update UI immediately as each batch arrives
                            setProducts(prev => {
                                // Smart merge: keep newest data, prevent dupes
                                const next = [...prev];
                                const existingIds = new Set(prev.map(p => p.id));
                                res.data.forEach(p => {
                                    if (!existingIds.has(p.id)) {
                                        next.push(p);
                                        existingIds.add(p.id);
                                    }
                                });
                                return next;
                            });
                            setConnectionStatus('syncing');
                        }
                        return res;
                    });
                    batchPromises.push(promise);
                }

                const results = await Promise.allSettled(batchPromises);
                if (cancelled) return;

                // Final Merge - consolidate all data for IndexedDB and ensure state is complete
                let allProductsFetched = [];
                let anyFailed = false;
                results.forEach((result) => {
                    if (result.status === 'fulfilled' && result.value.data) {
                        allProductsFetched = [...allProductsFetched, ...result.value.data];
                    } else if (result.status === 'rejected' || (result.value && result.value.error)) {
                        anyFailed = true;
                    }
                });

                const elapsed = (performance.now() - startTime).toFixed(0);

                if (allProductsFetched.length > 0) {
                    setConnectionStatus(anyFailed ? 'cached' : 'connected');
                    console.log(`[Turbo] 🚀 Loaded ${allProductsFetched.length} products total in ${elapsed}ms (${batchPromises.length} parallel batches)`);

                    // Save to IndexedDB in background
                    idbPutAll(allProductsFetched).then(() => {
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
        };

        turboLoad();

        // ============================================
        // 📡 BATCHED REAL-TIME SUBSCRIPTION
        // (Prevents UI lag if 1,000 items update at once)
        // ============================================
        let updateQueue = [];
        let updateTimer = null;

        const processQueue = () => {
            if (updateQueue.length === 0) return;
            const currentBatch = [...updateQueue];
            updateQueue = [];

            setProducts(prev => {
                let next = [...prev];
                const puts = [];
                const deletes = [];

                currentBatch.forEach(payload => {
                    if (payload.eventType === 'INSERT') {
                        next.push(payload.new);
                        puts.push(payload.new);
                    } else if (payload.eventType === 'UPDATE') {
                        const idx = next.findIndex(p => p.id === payload.new.id);
                        if (idx !== -1) {
                             next[idx] = { ...next[idx], ...payload.new };
                        } else {
                             next.push(payload.new);
                        }
                        puts.push(payload.new);
                    } else if (payload.eventType === 'DELETE') {
                        next = next.filter(p => p.id !== payload.old.id);
                        deletes.push(payload.old.id);
                    }
                });

                if (puts.length > 0) idbPutAll(puts);
                if (deletes.length > 0) idbDeleteIds(deletes);

                return next;
            });
        };

        const channel = supabase
            .channel('products_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                updateQueue.push(payload);
                if (!updateTimer) {
                    updateTimer = setTimeout(() => {
                        processQueue();
                        updateTimer = null;
                    }, 300); // 300ms buffer window
                }
            })
            .subscribe();

        return () => {
            cancelled = true;
            fetchedRef.current = false;
            if (updateTimer) clearTimeout(updateTimer);
            supabase.removeChannel(channel);
        };
    }, [user]);

    const addProduct = React.useCallback(async (productData) => {
        const { id, barcode, ...data } = productData;
        const trimmedBarcode = barcode ? String(barcode).trim() : '';

        let existingId = id;
        if (!existingId && trimmedBarcode) {
            const existing = barcodeMap.get(trimmedBarcode.toLowerCase())?.product;
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
    }, [barcodeMap]);

    const updateProduct = React.useCallback(async (id, updatedData) => {
        if (updatedData.price !== undefined) {
             const oldProduct = productMap.get(id);
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
    }, [productMap]);

    const deleteProduct = React.useCallback(async (id) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }, []);

    const addStock = React.useCallback(async (productId, amount, unitType = 'unit', newCostPrice = null) => {
        const product = productMap.get(productId);
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
    }, [productMap, updateProduct]);

    const bulkDeductStock = React.useCallback(async (deductions) => {
        if (!deductions || deductions.length === 0) return;

        const updates = deductions.map(({ productId, amount }) => {
            const product = productMap.get(productId);
            if (!product) return null;

            const deductAmount = parseFloat(amount || 0);
            const newStock = (parseFloat(product.stock) || 0) - deductAmount;
            const newSold = (parseFloat(product.soldToday) || 0) + deductAmount;

            // Important: only include necessary fields for upsert to reduce payload
            return {
                id: productId,
                name: product.name, // Usually required NOT NULL in DB
                stock: newStock,
                soldToday: newSold,
                lastSoldAt: new Date().toISOString()
            };
        }).filter(Boolean);

        if (updates.length > 0) {
            const { error } = await supabase.from('products').upsert(updates);
            if (error) throw error;
            
             setProducts(prev => {
                const refreshed = [...prev];
                updates.forEach(u => {
                    const i = refreshed.findIndex(p => p.id === u.id);
                    if (i !== -1) {
                         refreshed[i] = { ...refreshed[i], ...u };
                    }
                });
                return refreshed;
            });
        }
    }, [productMap]);

    const deductStock = React.useCallback(async (productId, amount) => {
        const product = productMap.get(productId);
        if (!product) return;

        const deductAmount = parseFloat(amount || 0);
        const newStock = (parseFloat(product.stock) || 0) - deductAmount;
        const newSold = (parseFloat(product.soldToday) || 0) + deductAmount;

        await updateProduct(productId, {
            stock: newStock,
            soldToday: newSold,
            lastSoldAt: new Date().toISOString()
        });
    }, [productMap, updateProduct]);

    const withdrawStock = React.useCallback(async (productId, amount) => {
        const product = productMap.get(productId);
        if (!product) return;
        await updateProduct(productId, { stock: (parseFloat(product.stock) || 0) - amount });
    }, [productMap, updateProduct]);

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

        const updates = [];
        for (const p of products) {
            const name = p.name.toLowerCase();
            for (const rule of rules) {
                if (rule.keys.some(k => name.includes(k.toLowerCase()))) {
                    if (p.category !== rule.cat) {
                        updates.push({ id: p.id, category: rule.cat, name: p.name }); // Include name for NOT NULL constraints if needed
                    }
                    break;
                }
            }
        }

        if (updates.length > 0) {
            console.log(`[Turbo] 📂 Bulk categorizing ${updates.length} products...`);
            const chunk = 100;
            for (let i = 0; i < updates.length; i += chunk) {
                const batch = updates.slice(i, i + chunk);
                const { error } = await supabase.from('products').upsert(batch);
                if (error) console.error("Bulk category error:", error);
            }
        }
        return updates.length;
    }, [products]);

    const getProductByBarcode = React.useCallback((barcode) => {
        if (!barcode) return undefined;
        const cleanCode = String(barcode).trim().toLowerCase();
        
        // Exact O(1) match
        let result = barcodeMap.get(cleanCode);
        if (result) return result;

        // Try with leading zero
        result = barcodeMap.get(`0${cleanCode}`);
        if (result) return result;

        // Try removing leading zero
        if (cleanCode.startsWith('0')) {
            result = barcodeMap.get(cleanCode.substring(1));
            if (result) return result;
        }

        return undefined;
    }, [barcodeMap]);

    const value = React.useMemo(() => ({
        products,
        productMap,
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
        recordWaste,
        bulkDeductStock
    }), [
        products, productMap, loading, connectionStatus, getProductByBarcode, addProduct, updateProduct, deleteProduct,
        addStock, deductStock, withdrawStock, resetProductSales, clearAllProducts,
        resetAllProductVisibility, updateProductOrder, bulkUpdateVisibilityByImage,
        bulkAutoCategorize, resetShowInStore, recordWaste, bulkDeductStock
    ]);

    return (
        <ProductContext.Provider value={value}>
            {children}
        </ProductContext.Provider>
    );
};
