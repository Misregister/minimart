import React, { useMemo, useState, useEffect } from 'react';
import { useProduct } from '../contexts/ProductContext';
import { useShift } from '../contexts/ShiftContext';
import { useCustomer } from '../contexts/CustomerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useOrder } from '../contexts/OrderContext';
import Card from '../components/common/Card';
import { DollarSign, ShoppingBag, AlertTriangle, Users, TrendingUp, Package } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
    // 1. Safe Context Destructuring
    const productContext = useProduct();
    const shiftContext = useShift();
    const customerContext = useCustomer();
    const languageContext = useLanguage();
    const orderContext = useOrder();

    const products = productContext?.products || [];
    const { orders: globalOrders } = orderContext;
    const customers = customerContext?.customers || [];
    const t = languageContext?.t || ((k) => k);

    const [dateRange, setDateRange] = useState('today'); // 'today'
    const [viewMode, setViewMode] = useState('all'); // 'all', 'pos', 'delivery'
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [activeTransactions, setActiveTransactions] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]); // Delivery Orders
    const [isLoadingTxs, setIsLoadingTxs] = useState(true);

    // Auto-refresh every 5 seconds (fallback)
    useEffect(() => {
        const interval = setInterval(() => {
            setLastUpdate(Date.now());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // 2. Real-time Data Fetching (Orders Only - Transactions come from Context)
    useEffect(() => {
        setActiveTransactions(shiftContext?.globalTransactions || []);
        setActiveOrders(globalOrders || []);
        setIsLoadingTxs(false);
    }, [shiftContext?.globalTransactions, globalOrders]);

    // 3. Filtering & Processing
    const filteredData = useMemo(() => {
        try {
            const now = new Date();
            let startTime = new Date();
            let endTime = new Date();

            // Date Range Logic
            switch (dateRange) {
                case 'today':
                    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    break;
                case 'week':
                    const day = now.getDay();
                    const diff = now.getDate() - day;
                    startTime = new Date(now.setDate(diff));
                    startTime.setHours(0, 0, 0, 0);
                    endTime = new Date();
                    break;
                case 'month':
                    startTime = new Date(now.getFullYear(), now.getMonth(), 1);
                    endTime = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    break;
                case 'year':
                    startTime = new Date(now.getFullYear(), 0, 1);
                    endTime = new Date(now.getFullYear() + 1, 0, 1);
                    break;
                case 'all':
                    startTime = new Date(0); // Beginning of epoch
                    endTime = new Date(8640000000000000); // Max date
                    break;
                default:
                    startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            }

            const startTs = startTime.getTime();
            const endTs = endTime.getTime();

            // Helper to check time range
            const isInRange = (isoTime) => {
                const t = new Date(isoTime).getTime();
                return t >= startTs && t <= endTs;
            };

            // Process POS (Transactions)
            const validTransactions = activeTransactions.filter(tx => {
                if (viewMode === 'delivery') return false; // Hide POS if view is delivery
                if (!tx || tx.status === 'voided') return false;
                return isInRange(tx.time);
            });

            // Process Delivery (Orders) - Filter out cancelled
            const validOrders = activeOrders.filter(ord => {
                if (viewMode === 'pos') return false; // Hide Delivery if view is POS
                if (!ord || ord.status === 'cancelled') return false;
                // Use createdAt or time
                const oTime = ord.createdAt || ord.time;
                return isInRange(oTime);
            });

            // --- Calculation Helpers ---
            const calculateProfit = (items) => {
                if (!Array.isArray(items)) return 0;
                return items.reduce((sum, item) => {
                    const qty = Number(item.quantity) || 0;
                    const soldPrice = Number(item.price) || 0; // Price per unit/pack

                    let cost = Number(item.cost);

                    // If cost is missing or dynamic lookup needed (e.g. current product cost)
                    if (isNaN(cost) || cost === 0) {
                        const product = products.find(p => p.id === (item.originalId || item.id));
                        // Adjusted cost based on unit type
                        if (product) {
                            if (item.isCase) cost = Number(product.caseCost || (product.cost * (product.caseSize || 1)));
                            else if (item.isPack) cost = Number(product.packCost || (product.cost * (product.packSize || 1)));
                            else cost = Number(product.cost);
                        }
                    }

                    // Fallback to 0
                    cost = convertToNumber(cost);

                    return sum + ((soldPrice - cost) * qty);
                }, 0);
            };

            const convertToNumber = (val) => Number(val) || 0;

            // --- Metrics: POS ---
            const posSales = validTransactions.reduce((sum, t) => sum + (t.type === 'expense' ? 0 : convertToNumber(t.amount)), 0)
                - validTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + convertToNumber(t.amount), 0);

            const posProfit = validTransactions.reduce((sum, t) => {
                if (t.type === 'expense') return sum; // Profit doesn't subtract expense here (Gloss Profit), or should it? Usually Gross Profit from Sales.
                if (t.type === 'sale') return sum + calculateProfit(t.items);
                return sum;
            }, 0);

            // --- Metrics: Delivery ---
            const deliverySales = validOrders.reduce((sum, o) => sum + convertToNumber(o.total), 0);
            const deliveryProfit = validOrders.reduce((sum, o) => sum + calculateProfit(o.items), 0);

            // --- Totals ---
            const totalSales = posSales + deliverySales;
            const estimatedProfit = posProfit + deliveryProfit;
            const totalOrders = validTransactions.filter(t => t.type === 'sale').length + validOrders.length;
            const posOrdersCount = validTransactions.filter(t => t.type === 'sale').length;
            const deliveryOrdersCount = validOrders.length;


            // Accumulate Product Sales for Lists (Merged)
            const allProductSales = {};
            const productProfits = {};
            const productRevenues = {};

            const processItems = (items) => {
                items.forEach(item => {
                    const qty = Number(item.quantity) || 0;
                    const pid = item.originalId || item.id;
                    allProductSales[pid] = (allProductSales[pid] || 0) + qty;

                    const soldPrice = Number(item.price) || 0;
                    productRevenues[pid] = (productRevenues[pid] || 0) + (soldPrice * qty);

                    // Profit calc for map
                    let cost = Number(item.cost);
                    if (isNaN(cost) || cost === 0) {
                        const product = products.find(p => p.id === pid);
                        if (product) {
                            if (item.isCase) cost = Number(product.caseCost || (product.cost * (product.caseSize || 1)));
                            else if (item.isPack) cost = Number(product.packCost || (product.cost * (product.packSize || 1)));
                            else cost = Number(product.cost);
                        }
                    }
                    cost = convertToNumber(cost);
                    productProfits[pid] = (productProfits[pid] || 0) + ((soldPrice - cost) * qty);
                });
            };

            validTransactions.filter(t => t.type === 'sale').forEach(t => processItems(t.items || []));
            validOrders.forEach(o => processItems(o.items || []));


            // --- Aggregations for New Charts ---
            const salesByCategory = {};
            const salesByPaymentMethod = {};
            const hourlySales = Array(24).fill(0);

            // Helper to aggregate data
            const aggregateTransaction = (tx, isDelivery = false) => {
                const amount = convertToNumber(isDelivery ? tx.total : tx.amount);

                // 1. Payment Method (POS only usually, typically 'cash' or 'qr')
                // Delivery might use 'cod' or 'transfer'
                const method = tx.paymentMethod || tx.method || 'unknown';
                salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + amount;

                // 2. Hourly Sales
                const oTime = isDelivery ? (tx.createdAt || tx.time) : tx.time;
                const d = new Date(oTime);
                const h = d.getHours();
                if (!isNaN(h) && h >= 0 && h < 24) hourlySales[h] += amount;

                // 3. Category Sales (Requires Item Iteration)
                if (Array.isArray(tx.items)) {
                    tx.items.forEach(item => {
                        const itemTotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
                        const pid = item.originalId || item.id;
                        // Find product to get category
                        const product = products.find(p => p.id === pid);
                        const category = product?.category || 'Uncategorized';
                        salesByCategory[category] = (salesByCategory[category] || 0) + itemTotal;
                    });
                }
            };

            validTransactions.filter(t => t.type === 'sale').forEach(t => aggregateTransaction(t));
            validOrders.forEach(o => aggregateTransaction(o, true));

            // --- Aggregations: Delivery Status ---
            const deliveryStatusCounts = {
                pending: 0,
                preparing: 0,
                shipping: 0,
                delivered: 0,
                archived: 0
            };
            validOrders.forEach(o => {
                if (deliveryStatusCounts.hasOwnProperty(o.status)) {
                    deliveryStatusCounts[o.status]++;
                }
            });

            // Prepare Chart Data (Split by type for Stacked Chart)
            let chartData = [];
            const posEvents = validTransactions.filter(t => t.type === 'sale').map(t => ({ time: t.time, amount: t.amount }));
            const deliveryEvents = validOrders.map(o => ({ time: o.createdAt || o.time, amount: o.total }));

            if (dateRange === 'today') {
                chartData = Array.from({ length: 24 }, (_, i) => ({
                    name: `${i.toString().padStart(2, '0')}:00`,
                    pos: 0,
                    delivery: 0
                }));
                posEvents.forEach(e => {
                    const h = new Date(e.time).getHours();
                    if (chartData[h]) chartData[h].pos += convertToNumber(e.amount);
                });
                deliveryEvents.forEach(e => {
                    const h = new Date(e.time).getHours();
                    if (chartData[h]) chartData[h].delivery += convertToNumber(e.amount);
                });
            } else {
                const dayMap = {}; // { key: { pos, delivery } }
                const processEvent = (e, type) => {
                    const d = new Date(e.time);
                    const key = `${d.getDate()}/${d.getMonth() + 1}`;
                    if (!dayMap[key]) dayMap[key] = { pos: 0, delivery: 0 };
                    dayMap[key][type] += convertToNumber(e.amount);
                };
                posEvents.forEach(e => processEvent(e, 'pos'));
                deliveryEvents.forEach(e => processEvent(e, 'delivery'));
                chartData = Object.entries(dayMap).map(([k, v]) => ({ name: k, ...v }));
            }

            // Format data for Recharts
            const salesByCategoryData = Object.entries(salesByCategory)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const salesByMethodData = Object.entries(salesByPaymentMethod)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const hourlySalesData = hourlySales.map((sales, hour) => ({
                name: `${hour}:00`,
                sales
            }));

            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            return {
                totalSales,
                posSales,
                deliverySales,
                totalOrders,
                posOrdersCount,
                deliveryOrdersCount,
                estimatedProfit,
                posProfit,
                deliveryProfit,
                allProductSales,
                productProfits,
                productRevenues,
                chartData,
                validTransactions,
                validOrders,
                // New Metrics
                salesByCategoryData,
                salesByMethodData,
                hourlySalesData,
                avgOrderValue,
                deliveryStatusCounts
            };

        } catch (err) {
            console.error("Critical Dashboard Error:", err);
            return {
                totalSales: 0, posSales: 0, deliverySales: 0,
                totalOrders: 0, posOrdersCount: 0, deliveryOrdersCount: 0,
                estimatedProfit: 0, posProfit: 0, deliveryProfit: 0,
                allProductSales: {},
                chartData: [],
                validTransactions: [],
                validOrders: [],
                salesByCategoryData: [],
                salesByMethodData: [],
                hourlySalesData: [],
                avgOrderValue: 0,
                deliveryStatusCounts: { pending: 0, preparing: 0, shipping: 0, delivered: 0, archived: 0 }
            };
        }
    }, [dateRange, viewMode, activeTransactions, activeOrders, products, lastUpdate]);

    // 3. Safe Metrics
    const lowStockCount = useMemo(() => {
        try {
            return products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 0)).length;
        } catch { return 0; }
    }, [products]);

    const totalDebt = useMemo(() => {
        try {
            return customers.reduce((sum, c) => sum + (Number(c.totalDebt) || 0), 0);
        } catch { return 0; }
    }, [customers]);

    const productStats = useMemo(() => {
        try {
            if (filteredData.productProfits) {
                const sortedByProfit = Object.entries(filteredData.productProfits)
                    .map(([pid, profit]) => {
                        const product = products.find(p => p.id === pid);
                        const soldQty = filteredData.allProductSales[pid] || 0;
                        const revenue = filteredData.productRevenues ? filteredData.productRevenues[pid] || 0 : 0;
                        return product ? { ...product, totalProfit: profit, soldQuantity: soldQty, totalSales: revenue } : null;
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.totalProfit - a.totalProfit);

                const top5 = sortedByProfit.slice(0, 5);
                const bottom5 = sortedByProfit
                    .sort((a, b) => a.totalProfit - b.totalProfit)
                    .slice(0, 5);

                return { top5, bottom5 };
            }
            return { top5: [], bottom5: [] };
        } catch {
            return { top5: [], bottom5: [] };
        }
    }, [filteredData, products]);

    const { bestSellers, mostProfitableProducts, leastProfitableProducts } = useMemo(() => {
        const bs = Object.entries(filteredData.allProductSales)
            .map(([pid, qty]) => {
                const product = products.find(p => p.id === pid);
                const profit = filteredData.productProfits ? filteredData.productProfits[pid] || 0 : 0;
                const revenue = filteredData.productRevenues ? filteredData.productRevenues[pid] || 0 : 0;
                return product ? { ...product, soldQuantity: qty, totalProfit: profit, totalSales: revenue } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.soldQuantity - a.soldQuantity)
            .slice(0, 5);

        return {
            bestSellers: bs,
            mostProfitableProducts: productStats.top5,
            leastProfitableProducts: productStats.bottom5
        };
    }, [filteredData, products, productStats]);

    // Yesterday's Sales Calculation from activeTransactions (Use passed buffer data)
    const yesterdayData = useMemo(() => {
        try {
            const now = new Date();
            const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startTs = yesterdayStart.getTime();
            const endTs = yesterdayEnd.getTime();

            const isYest = (isoTime) => {
                const t = new Date(isoTime).getTime();
                return t >= startTs && t < endTs;
            };

            // Filter Yesterday Transactions (POS)
            const yesterdayTransactions = activeTransactions.filter(tx => {
                if (!tx || tx.status === 'voided') return false;
                return isYest(tx.time);
            });

            // Filter Yesterday Orders (Delivery)
            const yesterdayOrders = activeOrders.filter(ord => {
                if (!ord || ord.status === 'cancelled') return false;
                return isYest(ord.createdAt || ord.time);
            });

            const posSales = yesterdayTransactions.reduce((sum, t) => sum + (t.type === 'expense' ? 0 : (Number(t.amount) || 0)), 0)
                - yesterdayTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const deliverySales = yesterdayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
            const totalSales = posSales + deliverySales;
            const totalOrders = yesterdayTransactions.filter(t => t.type === 'sale').length + yesterdayOrders.length;

            return { totalSales, totalOrders };
        } catch (err) {
            console.error("Yesterday data calculation error:", err);
            return { totalSales: 0, totalOrders: 0 };
        }
    }, [activeTransactions, activeOrders, lastUpdate]);

    // Calculate comparison percentages
    const salesComparison = useMemo(() => {
        const todaySales = filteredData.totalSales;
        const yesterdaySales = yesterdayData.totalSales;

        let percentChange = 0;
        if (yesterdaySales > 0) {
            percentChange = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        } else if (todaySales > 0) {
            percentChange = 100; // New sales from 0
        }

        const ordersDiff = filteredData.totalOrders - yesterdayData.totalOrders;

        return {
            todaySales,
            yesterdaySales,
            percentChange,
            isUp: percentChange >= 0,
            ordersDiff,
            ordersIsUp: ordersDiff >= 0
        };
    }, [filteredData, yesterdayData]);

    const handleExportCSV = (type) => {
        // ... (Export Logic same as before but safe)
        try {
            let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
            if (type === 'transactions') {
                csvContent += "Date,Time,Type,Amount,Method,Items Info\n";
                filteredData.validTransactions.forEach(tx => {
                    const d = new Date(tx.time);
                    const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString('th-TH') : '-';
                    const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString('th-TH') : '-';
                    let itemsStr = "";
                    if (Array.isArray(tx.items)) {
                        itemsStr = tx.items.map(i => `${i.name} (${i.quantity})`).join("; ");
                    }
                    csvContent += `${dateStr},${timeStr},${tx.type},${tx.amount},${tx.method},"${itemsStr}"\n`;
                });
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", `sales_report.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (type === 'products') {
                csvContent += "Barcode,Name,Category,Cost,Price,Stock,Revenue\n";
                products.forEach(p => {
                    const soldQty = filteredData.allProductSales[p.id] || 0;
                    const revenue = soldQty * (Number(p.price) || 0);
                    csvContent += `"${p.barcode}","${p.name}","${p.category || '-'}",${p.cost},${p.price},${p.stock},${revenue}\n`;
                });
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute("download", `product_report.csv`);
                document.body.removeChild(link);
            }
        } catch (e) { console.error("Export Error", e); }
    };

    // Colors for Charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="dashboard-container" style={{ padding: '1.5rem', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            {/* Header & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>ภาพรวมผลประกอบการ (Dashboard)</h1>
                    <p style={{ color: '#64748b' }}>{t('monitorBusinessPerformance') || 'ติดตามและวิเคราะห์ยอดขายของร้านค้า'}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="period-selector" style={{ background: 'white', padding: '0.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', marginRight: '1rem' }}>
                        {['all', 'pos', 'delivery'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: viewMode === mode ? '#10b981' : 'transparent',
                                    color: viewMode === mode ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {mode === 'all' ? 'All (ทั้งหมด)' : mode === 'pos' ? 'Storefront (หน้าร้าน)' : 'Delivery (พัสดุ/จัดส่ง)'}
                            </button>
                        ))}
                    </div>

                    <div className="period-selector" style={{ background: 'white', padding: '0.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex' }}>
                        {['today', 'week', 'month', 'year', 'all'].map(p => (
                            <button
                                key={p}
                                onClick={() => setDateRange(p)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: dateRange === p ? '#2563eb' : 'transparent',
                                    color: dateRange === p ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {p === 'today' ? 'วันนี้' : p === 'week' ? 'สัปดาห์นี้' : p === 'month' ? 'เดือนนี้' : p === 'year' ? 'ปีนี้' : 'ทั้งหมด'}
                            </button>
                        ))}
                    </div>

                </div>
            </div>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}><DollarSign size={24} /></div>
                            <div>
                                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem', fontWeight: '500' }}>{t('totalSales') || 'ยอดขายรวมทั้งหมด'}</p>
                                <h3 style={{ margin: 0, fontSize: '1.85rem', fontWeight: '800', letterSpacing: '-0.025em' }}>฿ {filteredData.totalSales.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                            {dateRange === 'today' ? 'วันนี้' : dateRange === 'week' ? 'สัปดาห์นี้' : 'รายเดือน/ปี'}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.7rem', textTransform: 'uppercase' }}>หน้าร้าน (Storefront)</p>
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>฿ {filteredData.posSales.toLocaleString()}</p>
                        </div>
                        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1rem' }}>
                            <p style={{ margin: 0, opacity: 0.7, fontSize: '0.7rem', textTransform: 'uppercase' }}>จัดส่ง (Delivery)</p>
                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>฿ {filteredData.deliverySales.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '12px', color: '#10b981' }}><TrendingUp size={24} /></div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{t('profit') || 'กำไรที่คาดการณ์'}</p>
                            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#059669' }}>฿ {filteredData.estimatedProfit.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                        <span>หน้าร้าน: ฿{filteredData.posProfit.toLocaleString()}</span>
                        <span>จัดส่ง: ฿{filteredData.deliveryProfit.toLocaleString()}</span>
                    </div>
                </Card>

                <Card style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}><ShoppingBag size={24} /></div>
                        <div>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{t('totalOrders') || 'จำนวนบิลรวม'}</p>
                            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b' }}>{filteredData.totalOrders}</h3>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                        <span>หน้าร้าน: {filteredData.posOrdersCount}</span>
                        <span>จัดส่ง: {filteredData.deliveryOrdersCount}</span>
                    </div>
                </Card>

                <Card style={{ background: '#fff7ed', border: '1px solid #ffedd5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: '#ffedd5', borderRadius: '12px', color: '#ea580c' }}><Package size={24} /></div>
                        <div>
                            <p style={{ margin: 0, color: '#9a3412', fontSize: '0.875rem' }}>ออร์เดอร์รอจัดส่ง (Pending)</p>
                            <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold', color: '#c2410c' }}>{filteredData.deliveryStatusCounts.pending + filteredData.deliveryStatusCounts.preparing}</h3>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9a3412', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #fed7aa' }}>
                        กำลังส่ง: {filteredData.deliveryStatusCounts.shipping} | สำเร็จ: {filteredData.deliveryStatusCounts.delivered}
                    </div>
                </Card>
            </div>

            {/* Main Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Revenue Chart */}
                <Card style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1e293b' }}>📈 แนวโน้มยอดขาย (Revenue Trends)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={filteredData.chartData}>
                            <defs>
                                <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorDelivery" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dx={-10} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Area type="monotone" name="หน้าร้าน (Storefront)" dataKey="pos" stroke="#2563eb" fillOpacity={1} fill="url(#colorPos)" strokeWidth={2} stackId="1" />
                            <Area type="monotone" name="จัดส่ง (Delivery)" dataKey="delivery" stroke="#10b981" fillOpacity={1} fill="url(#colorDelivery)" strokeWidth={2} stackId="1" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* Sales by Category (Pie) */}
                <Card style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1e293b' }}>📊 สัดส่วนตามหมวดหมู่สินค้า</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={filteredData.salesByCategoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {filteredData.salesByCategoryData.map((entry, index) => (
                                    <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Secondary Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Hourly Sales (Bar) */}
                <Card style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem', color: '#1e293b' }}>📉 สินค้ากำไรน้อย / ขาดทุน</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {leastProfitableProducts.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>ไม่มีข้อมูล</p> :
                            leastProfitableProducts.map((product, i) => {
                                const isLoss = product.totalProfit < 0;
                                const profitPerUnit = product.soldQuantity > 0 ? (product.totalProfit / product.soldQuantity) : 0;
                                return (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#fff1f2', borderRadius: '12px', border: isLoss ? '1px solid #fca5a5' : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fecaca', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>{i + 1}</div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#7f1d1d' }}>{product.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                                                    ทุน: ฿{product.cost} | กำไร/ชิ้น: ฿{profitPerUnit.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '700', color: '#dc2626' }}>{product.totalProfit.toLocaleString()} ฿</div>
                                            <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>ยอดขาย: ฿{product.totalSales?.toLocaleString()} ({product.soldQuantity} ชิ้น)</div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </Card>

                {/* Top Products */}
                <Card style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem', color: '#1e293b' }}>🌟 5 อันดับ สินค้าขายดีที่สุด</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {bestSellers.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>ไม่มีข้อมูล</p> :
                            bestSellers.map((product, i) => {
                                const profitPerUnit = product.soldQuantity > 0 ? (product.totalProfit / product.soldQuantity) : 0;
                                return (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: i === 0 ? '#fef3c7' : '#e2e8f0', color: i === 0 ? '#d97706' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>{i + 1}</div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#334155' }}>{product.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    ราคาขาย: ฿{product.price} | กำไร/ชิ้น: ฿{profitPerUnit.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '700', color: '#3b82f6' }}>ขายได้ {product.soldQuantity} ชิ้น</div>
                                            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>กำไรรวม: ฿{product.totalProfit?.toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </Card>
            </div>
        </div>
    );
};
export default Dashboard;
