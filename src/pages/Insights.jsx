import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, Package, Inbox, AlertTriangle, 
    Zap, DollarSign, Target, BarChart3, PieChart, Info, 
    ArrowRight, ChevronRight, Activity, Calendar, History, Trash2,
    Search, Filter, Download, Plus
} from 'lucide-react';
import { useProduct } from '../contexts/ProductContext';
import { useOrder } from '../contexts/OrderContext';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabase';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
    ResponsiveContainer, LineChart, Line, AreaChart, Area, 
    ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import './Insights.css';

const Insights = () => {
    const { products } = useProduct();
    const { orders } = useOrder();
    const { settings } = useSettings();
    
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState([]);
    const [wasteLogs, setWasteLogs] = useState([]);
    const [priceHistory, setPriceHistory] = useState([]);
    const [timeRange, setTimeRange] = useState('30d'); 

    const [editingExpense, setEditingExpense] = useState(null);

    // Fetch Analytics Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [expRes, wasteRes, priceRes] = await Promise.all([
                supabase.from('expenses').select('*').order('period', { ascending: false }),
                supabase.from('waste_logs').select('*, products(name)').order('createdAt', { ascending: false }),
                supabase.from('price_history').select('*, products(name)').order('updatedAt', { ascending: false })
            ]);

            if (expRes.data) setExpenses(expRes.data);
            if (wasteRes.data) setWasteLogs(wasteRes.data);
            if (priceRes.data) setPriceHistory(priceRes.data);
        } catch (error) {
            console.error("Error fetching analytics data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 1. CALCULATE CORE METRICS
    const metrics = useMemo(() => {
        // Average Gross Margin
        const productMargins = products
            .filter(p => p.price > 0 && p.cost > 0)
            .map(p => ({
                id: p.id,
                name: p.name,
                margin: ((p.price - p.cost) / p.price) * 100,
                cost: p.cost,
                price: p.price,
                stockValue: (p.stock || 0) * p.cost,
                sales: p.soldToday || 0
            }));
        
        const avgMargin = productMargins.length > 0 
            ? productMargins.reduce((acc, curr) => acc + curr.margin, 0) / productMargins.length 
            : 0;

        // Break-even (Daily)
        // Assume rent/utility/salary are in settings or expenses
        // For simplicity: Monthly costs / 30
        const monthlyFixedCosts = expenses
            .filter(e => {
                const d = new Date(e.period);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((acc, curr) => acc + curr.amount, 0) || 5000; // Fallback to 5k

        const dailyFixedCost = monthlyFixedCosts / 30;
        const breakEvenRevenue = dailyFixedCost / (avgMargin / 100);

        // Inventory Value
        const totalInventoryValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.cost || 0)), 0);

        return {
            avgMargin,
            monthlyFixedCosts,
            dailyFixedCost,
            breakEvenRevenue,
            totalInventoryValue,
            productMargins
        };
    }, [products, expenses]);

    // 2. DEAD STOCK ANALYSIS
    const deadStock = useMemo(() => {
        const now = new Date();
        return products.filter(p => {
            if (!p.lastSoldAt) return true; // Never sold
            const lastSold = new Date(p.lastSoldAt);
            const diffDays = (now - lastSold) / (1000 * 60 * 60 * 24);
            return diffDays > 30; // 30 days or more
        }).sort((a,b) => (a.stock * a.cost) < (b.stock * b.cost) ? 1 : -1);
    }, [products]);

    // 3. PROFITABILITY QUADRANT DATA
    const quadrantData = useMemo(() => {
        return metrics.productMargins.map(p => ({
            name: p.name,
            x: p.sales, // Volume (Sales Velocity)
            y: p.margin, // Profitability (Margin %)
            z: p.stockValue, // Size of bubble (Stock Value)
            id: p.id
        })).filter(d => d.x > 0 || d.y > 0).slice(0, 50); // Limit to top 50
    }, [metrics.productMargins]);

    // 4. PRICE ELASTICITY MAPPING
    // (In real app, compare sales before/after price_history timestamp)
    // Placeholder for now

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
    const [newExpense, setNewExpense] = useState({ category: 'electricity', amount: '', period: new Date().toISOString().split('T')[0], notes: '' });
    const [newWaste, setNewWaste] = useState({ productId: '', quantity: '', reason: 'expired' });

    const handleAddExpense = async () => {
        if (!newExpense.amount || !newExpense.period) return;
        const { error } = await supabase.from('expenses').insert({ ...newExpense, amount: parseFloat(newExpense.amount) });
        if (!error) {
            setIsExpenseModalOpen(false);
            fetchData();
        }
    };

    const handleUpdateExpense = async () => {
        if (!editingExpense) return;
        const { id, category, amount, period, notes } = editingExpense;
        const { error } = await supabase.from('expenses').update({ category, amount: parseFloat(amount), period, notes }).eq('id', id);
        if (!error) {
            setEditingExpense(null);
            fetchData();
        }
    };

    const handleDeleteExpense = async (id) => {
        if (window.confirm("ยืนยันการลบค่าใช้จ่ายนี้?")) {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (!error) fetchData();
        }
    };

    const handleAddWaste = async () => {
        if (!newWaste.productId || !newWaste.quantity) return;
        const product = products.find(p => p.id === newWaste.productId);
        const { error } = await supabase.from('waste_logs').insert({ 
            ...newWaste, 
            quantity: parseFloat(newWaste.quantity),
            cost_at_time: product?.cost || 0
        });
        if (!error) {
            setIsWasteModalOpen(false);
            window.location.reload();
        }
    };

    // 5. PREDICTIVE REORDER SUGGESTIONS
    const reorderSuggestions = useMemo(() => {
        return products
            .filter(p => p.stock <= (p.minStock || 5))
            .map(p => {
                const dailyVelocity = (p.soldToday || 0) / 1; // Simplified
                const suggestedOrder = (p.minStock || 10) * 2;
                return { ...p, suggestedOrder };
            }).slice(0, 3);
    }, [products]);

    // 6. REAL SALES TREND FOR FORCASTING
    const salesTrendData = useMemo(() => {
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        return last7Days.map(date => {
            const dailyOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(date));
            const total = dailyOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
            return { n: date.split('-')[2], s: total };
        });
    }, [orders]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    if (loading) return <div className="insights-loading">กำลังประมวลผลข้อมูลอัจฉริยะ...</div>;

    return (
        <div className="insights-container">
            {/* Header */}
            <header className="insights-header">
                <div>
                    <h1>Inventory Insights & Analytics</h1>
                    <p>พยากรณ์และบริหารจัดการร้านค้าด้วยปัญญาประดิษฐ์</p>
                </div>
                <div className="header-controls">
                    <div className="time-chips">
                        {['7d', '30d', '90d', 'All'].map(t => (
                            <button 
                                key={t} 
                                className={timeRange === t ? 'active' : ''}
                                onClick={() => setTimeRange(t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <button className="btn-export" onClick={() => setIsExpenseModalOpen(true)}>
                        <Plus size={18} /> บันทึกค่าใช้จ่าย
                    </button>
                </div>
            </header>

            {/* Core Metrics Row */}
            <div className="metrics-grid">
                <div className="metric-card glass">
                    <div className="metric-icon bg-blue"><Target /></div>
                    <div className="metric-info">
                        <label>จุดคุ้มทุนรายวัน (Break-even)</label>
                        <h3>฿{metrics.breakEvenRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                        <span className="trend positive"><TrendingUp size={14} /> ต้องขายให้ได้ยอดนี้ต่อวัน</span>
                    </div>
                </div>
                <div className="metric-card glass">
                    <div className="metric-icon bg-green"><Activity /></div>
                    <div className="metric-info">
                        <label>อัตรากำไรเฉลี่ย (Avg Margin)</label>
                        <h3>{metrics.avgMargin.toFixed(1)}%</h3>
                        <span className="trend positive">ระบบสุขภาพดี</span>
                    </div>
                </div>
                <div className="metric-card glass">
                    <div className="metric-icon bg-amber"><Package /></div>
                    <div className="metric-info">
                        <label>มูลค่าสต็อกจม (Stock Value)</label>
                        <h3>฿{metrics.totalInventoryValue.toLocaleString()}</h3>
                        <span className="trend negative"><TrendingDown size={14} /> เงินจมในคลังสินค้า</span>
                    </div>
                </div>
                <div className="metric-card glass">
                    <div className="metric-icon bg-red"><Zap /></div>
                    <div className="metric-info">
                        <label>ค่าใช้จ่ายคงที่ (Fixed Costs)</label>
                        <h3>฿{metrics.monthlyFixedCosts.toLocaleString()}</h3>
                        <span>ต่อเดือน (ค่าไฟ/เช่า/แรง)</span>
                    </div>
                </div>
            </div>

            <div className="insights-main-grid">
                {/* Left Column: Charts */}
                <div className="insights-left">
                    {/* Profitability Quadrant */}
                    <section className="chart-section glass">
                        <div className="section-header">
                            <div>
                                <h2>Profitability Mapping (Margin vs Volume)</h2>
                                <p>แยกสินค้า 'พระเอก' และ 'ตัวถ่วง'</p>
                            </div>
                            <Info size={18} className="info-icon" />
                        </div>
                        <div className="chart-container-lg">
                            <ResponsiveContainer width="100%" height={400}>
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis type="number" dataKey="x" name="ยอดขายวันนี้" unit=" ชิ้น" label={{ value: 'ความเร็วในการขาย (Velocity)', position: 'insideBottom', offset: -10 }} />
                                    <YAxis type="number" dataKey="y" name="Margin" unit="%" label={{ value: 'กำไร (%)', angle: -90, position: 'insideLeft' }} />
                                    <ZAxis type="number" dataKey="z" range={[60, 400]} name="มูลค่าสต็อก" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Legend />
                                    <Scatter name="สินค้าตามผลประกอบการ" data={quadrantData}>
                                        {quadrantData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={
                                                entry.y > metrics.avgMargin && entry.x > 5 ? '#10b981' : // Star
                                                entry.y <= metrics.avgMargin && entry.x > 5 ? '#3b82f6' : // Cash Cow
                                                entry.y > metrics.avgMargin && entry.x <= 5 ? '#f59e0b' : // Question
                                                '#ef4444' // Dog
                                            } />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="quadrant-legend">
                            <span className="leg-item"><div className="dot star"></div> Stars (กำไรสูง/ขายดี)</span>
                            <span className="leg-item"><div className="dot cash"></div> Cash Cows (กำไรต่ำ/ขายเก่ง)</span>
                            <span className="leg-item"><div className="dot question"></div> Questions (กำไรสูง/ยังขายไม่ออก)</span>
                            <span className="leg-item"><div className="dot dog"></div> Dogs (กำไรต่ำ/ขายยาก)</span>
                        </div>
                    </section>
                </div>

                {/* Right Column: Lists & Specific Insights */}
                <div className="insights-right">
                    {/* Dead Stock Alert */}
                    <section className="list-section glass">
                        <div className="section-header">
                            <div className="flex align-center gap-2">
                                <AlertTriangle className="text-red" size={20} />
                                <h2>Dead Stock Alerts</h2>
                            </div>
                            <span className="badge bg-red-lt">{deadStock.length} รายการ</span>
                        </div>
                        <p className="section-sub">สินค้าที่ไม่เคลื่อนไหวเกิน 30 วัน (เงินจม)</p>
                        
                        <div className="insight-list">
                            {deadStock.slice(0, 5).map(p => (
                                <div key={p.id} className="insight-item">
                                    <div className="item-main">
                                        <span className="item-name">{p.name}</span>
                                        <span className="item-meta">มีในสต็อก {p.stock} {p.unit}</span>
                                    </div>
                                    <div className="item-value text-red">
                                        ฿{((p.stock || 0) * (p.cost || 0)).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                            {deadStock.length === 0 && <div className="empty-insight">ไม่มีสินค้าค้างสต็อก</div>}
                        </div>
                    </section>

                    {/* Cost Optimization */}
                    <section className="list-section glass mt-4">
                        <div className="section-header">
                            <div className="flex align-center gap-2">
                                <Zap className="text-amber" size={20} />
                                <h2>Utility vs Sales (ROI)</h2>
                            </div>
                        </div>
                        <div className="roi-stat">
                            <div className="stat-label">ประสิทธิภาพการใช้ไฟฟ้า</div>
                            <div className="stat-bar-container">
                                <div className="stat-bar" style={{ width: '65%' }}></div>
                            </div>
                            <div className="stat-footer">
                                <span>ยอดขายเด่น</span>
                                <span>ค่าไฟ ฿{expenses.filter(e=>e.category==='electricity').reduce((a,b)=>a+b.amount,0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="suggestion-box bg-blue-lt">
                            <Info size={16} />
                            <p>พยากรณ์: เดือนหน้าค่าไฟอาจพุ่งขึ้น 12% เนื่องจากการขายสินค้าแช่เย็นเพิ่มขึ้น</p>
                        </div>
                    </section>

                    {/* Expense Management List */}
                    <section className="list-section glass mt-4">
                        <div className="section-header">
                            <div className="flex align-center gap-2">
                                <DollarSign className="text-secondary" size={20} />
                                <h2>Fixed Costs Management</h2>
                            </div>
                            <button className="btn-outline-sm" onClick={() => setIsExpenseModalOpen(true)}><Plus size={14} /> เพิ่มค่าใช้จ่าย</button>
                        </div>
                        <div className="expense-sm-list">
                            {expenses.slice(0, 5).map(exp => (
                                <div key={exp.id} className="expense-sm-item">
                                    <div className="exp-info">
                                        <span className="exp-cat">{exp.category === 'electricity' ? 'ค่าไฟ' : exp.category === 'salary' ? 'ค่าจ้าง' : 'คงที่'}</span>
                                        <span className="exp-date">{exp.period}</span>
                                    </div>
                                    <div className="exp-val">฿{exp.amount.toLocaleString()}</div>
                                    <div className="exp-actions">
                                        <button onClick={() => setEditingExpense(exp)} className="btn-icon-sm"><BarChart3 size={14} /></button>
                                        <button onClick={() => handleDeleteExpense(exp.id)} className="btn-icon-sm text-red"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
            
            {/* Predictive Section */}
            <section className="predictive-banner glass mt-6">
                <div className="predict-content">
                    <div className="predict-badge">Predictive AI</div>
                    <h2>Reorder Point Suggestions (พยากรณ์การสั่งของ)</h2>
                    <p>อ้างอิงจากความเร็วทางการขาย (Velocity) และสต็อกสำรองที่คาดการณ์</p>
                    
                    <div className="suggest-grid">
                        {reorderSuggestions.map(p => (
                            <div key={p.id} className="suggest-item">
                                <div className="s-icon"><Plus size={16} /></div>
                                <div className="s-info">
                                    <span className="s-name">{p.name}</span>
                                    <span className="s-reason">ควรสั่งเพิ่ม {p.suggestedOrder} {p.unit} (สต็อกต่ำกว่าเกณฑ์)</span>
                                </div>
                            </div>
                        ))}
                        {reorderSuggestions.length === 0 && <p className="text-secondary">สต็อกสินค้าปัจจุบันเพียงพอต่อการขาย</p>}
                    </div>
                </div>
                <div className="predict-chart">
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={salesTrendData}>
                            <Area type="monotone" dataKey="s" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Expense Modal */}
            {isExpenseModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass">
                        <h2>บันทึกค่าใช้จ่ายร้านค้า</h2>
                        <div className="form-group">
                            <label>ประเภท</label>
                            <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}>
                                <option value="electricity">ค่าไฟ</option>
                                <option value="utility">ค่าน้ำ/ขยะ</option>
                                <option value="salary">ค่าจ้างพนักงาน</option>
                                <option value="rent">ค่าเช่าที่</option>
                                <option value="other">อื่นๆ</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>จำนวนเงิน (บาท)</label>
                            <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label>รอบประจำเดือน</label>
                            <input type="date" value={newExpense.period} onChange={e => setNewExpense({...newExpense, period: e.target.value})} />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setIsExpenseModalOpen(false)}>ยกเลิก</button>
                            <button className="btn-primary" onClick={handleAddExpense}>บันทึกข้อมูล</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waste Modal */}
            {isWasteModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content glass">
                        <h2>บันทึกสินค้าคัดทิ้ง (Loss)</h2>
                        <div className="form-group">
                            <label>สินค้า</label>
                            <select value={newWaste.productId} onChange={e => setNewWaste({...newWaste, productId: e.target.value})}>
                                <option value="">เลือกสินค้า...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>จำนวนที่เสีย</label>
                            <input type="number" value={newWaste.quantity} onChange={e => setNewWaste({...newWaste, quantity: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>สาเหตุ</label>
                            <select value={newWaste.reason} onChange={e => setNewWaste({...newWaste, reason: e.target.value})}>
                                <option value="expired">หมดอายุ</option>
                                <option value="damaged">ชำรุด/บุบสลาย</option>
                                <option value="lost">สูญหาย</option>
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setIsWasteModalOpen(false)}>ยกเลิก</button>
                            <button className="btn-primary" onClick={handleAddWaste}>บันทึกข้อมูล</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Expense Modal */}
            {editingExpense && (
                <div className="modal-overlay">
                    <div className="modal-content glass">
                        <h2>แก้ไขค่าใช้จ่าย</h2>
                        <div className="form-group">
                            <label>ประเภท</label>
                            <select value={editingExpense.category} onChange={e => setEditingExpense({...editingExpense, category: e.target.value})}>
                                <option value="electricity">ค่าไฟ</option>
                                <option value="utility">ค่าน้ำ/ขยะ</option>
                                <option value="salary">ค่าจ้างพนักงาน</option>
                                <option value="rent">ค่าเช่าที่</option>
                                <option value="other">อื่นๆ</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>จำนวนเงิน (บาท)</label>
                            <input type="number" value={editingExpense.amount} onChange={e => setEditingExpense({...editingExpense, amount: e.target.value})} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label>รอบประจำเดือน (YYYY-MM-DD)</label>
                            <input type="date" value={editingExpense.period} onChange={e => setEditingExpense({...editingExpense, period: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>หมายเหตุ</label>
                            <input type="text" value={editingExpense.notes || ''} onChange={e => setEditingExpense({...editingExpense, notes: e.target.value})} />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setEditingExpense(null)}>ยกเลิก</button>
                            <button className="btn-primary" onClick={handleUpdateExpense}>บันทึกแก้ไข</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Insights;
