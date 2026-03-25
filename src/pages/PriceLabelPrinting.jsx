import React, { useState, useMemo } from 'react';
import { useProduct } from '../contexts/ProductContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { Search, Printer, CheckSquare, Square, Filter, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './PriceLabelPrinting.css';


const PriceLabelPrinting = () => {
    const { products } = useProduct();
    const navigate = useNavigate();

    // State
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState('all');
    const [template, setTemplate] = useState('standard');
    const [paperSize, setPaperSize] = useState('a4-5.5x3.5');
    const [showBarcode, setShowBarcode] = useState(true);

    // Manual Mode State
    const [mode, setMode] = useState('select'); // 'select' | 'manual'
    const [manualItems, setManualItems] = useState([]);
    const [manualForm, setManualForm] = useState({ category: 'สินค้าทั่วไป', price: '', count: 1 });


    // ... Filter Logic (unchanged) ...
    const filteredSource = useMemo(() => {
        if (filterMode === 'all' && !searchTerm.trim()) return [];
        let source = products;
        if (filterMode === 'updated') {
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            source = source.filter(p => p.updatedAt && new Date(p.updatedAt) > cutoff);
        } else if (filterMode === 'new') {
            const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
            source = source.filter(p => p.createdAt && new Date(p.createdAt) > cutoff);
        }
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            source = source.filter(p => (p.name || '').toLowerCase().includes(lower) || (p.barcode || '').includes(lower));
        }
        return source;
    }, [products, searchTerm, filterMode]);

    // Selection Handlers
    const toggleSelect = (id) => {
        const next = new Set(selectedProducts);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedProducts(next);
    };

    const selectAll = () => {
        if (selectedProducts.size === filteredSource.length) setSelectedProducts(new Set());
        else setSelectedProducts(new Set(filteredSource.map(p => p.id)));
    };

    const handlePrint = () => window.print();

    // Manual Handlers
    const addManualItem = () => {
        if (!manualForm.price) return;
        const newItem = {
            id: `manual-${Date.now()}`,
            name: '', // No name for manual items by default as requested
            category: manualForm.category,
            price: parseFloat(manualForm.price),
            barcode: '',
            isManual: true
        };

        // Add multiple copies if needed
        const newItems = Array(Math.max(1, parseInt(manualForm.count))).fill(newItem).map((item, i) => ({
            ...item,
            id: `${item.id}-${i}`
        }));

        setManualItems(prev => [...prev, ...newItems]);
        setManualForm(prev => ({ ...prev, price: '', count: 1 }));
    };

    const removeManualItem = (index) => {
        setManualItems(prev => prev.filter((_, i) => i !== index));
    };

    // Combined Print List
    const productsToPrint = useMemo(() => {
        const realProducts = products.filter(p => selectedProducts.has(p.id));
        return [...realProducts, ...manualItems];
    }, [products, selectedProducts, manualItems]);


    return (
        <div className="label-printing-page">
            <div className="controls-panel no-print">
                <div className="controls-header">
                    <Button variant="ghost" onClick={() => navigate('/inventory')} className="back-btn">
                        <ArrowLeft size={20} />
                    </Button>
                    <div className="header-title">
                        <h1>พิมพ์ป้ายราคา</h1>
                        <p>Price Labeler</p>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="mode-switcher" style={{ padding: '0 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => setMode('select')}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: mode === 'select' ? 'white' : 'transparent', fontWeight: mode === 'select' ? 600 : 400, boxShadow: mode === 'select' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            เลือกสินค้า
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: mode === 'manual' ? 'white' : 'transparent', fontWeight: mode === 'manual' ? 600 : 400, boxShadow: mode === 'manual' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}
                        >
                            สร้างเอง (Manual)
                        </button>
                    </div>
                </div>

                {mode === 'select' ? (
                    <div className="selection-area">
                        <div className="search-section">
                            <Input
                                icon={Search}
                                placeholder="ค้นหาสินค้า / บาร์โค้ด..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                            <div className="filter-tabs">
                                <button className={`tab-btn ${filterMode === 'all' ? 'active' : ''}`} onClick={() => setFilterMode('all')}>ทั้งหมด</button>
                                <button className={`tab-btn ${filterMode === 'updated' ? 'active' : ''}`} onClick={() => setFilterMode('updated')}>เพิ่งเปลี่ยนราคา</button>
                                <button className={`tab-btn ${filterMode === 'new' ? 'active' : ''}`} onClick={() => setFilterMode('new')}>สินค้าใหม่</button>
                            </div>
                        </div>

                        <div className="product-table-wrapper">
                            <table className="select-table">
                                <thead>
                                    <tr>
                                        <th className="th-checkbox">
                                            <div onClick={selectAll} className="checkbox-wrapper">
                                                {selectedProducts.size > 0 && selectedProducts.size === filteredSource.length
                                                    ? <CheckSquare size={20} className="icon-checked" />
                                                    : <Square size={20} className="icon-unchecked" />}
                                            </div>
                                        </th>
                                        <th>สินค้า</th>
                                        <th className="text-right">ราคา</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSource.map(product => (
                                        <tr key={product.id} onClick={() => toggleSelect(product.id)} className={selectedProducts.has(product.id) ? 'selected' : ''}>
                                            <td className="td-checkbox">
                                                <div className="checkbox-wrapper">
                                                    {selectedProducts.has(product.id) ? <CheckSquare size={20} className="icon-checked" /> : <Square size={20} className="icon-unchecked" />}
                                                </div>
                                            </td>
                                            <td className="td-product">
                                                <div className="product-info-cell">
                                                    <div className="product-text">
                                                        <div className="product-name">{product.name}</div>
                                                        <div className="product-meta">
                                                            <span className="badge-cat">{product.category}</span>
                                                            <span className="sku">{product.barcode}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="td-price text-right">
                                                <span className="price-tag">฿{Number(product.price).toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredSource.length === 0 && (
                                <div className="empty-state">
                                    <Search size={40} className="empty-icon" />
                                    <p>ไม่พบสินค้า</p>
                                </div>
                            )}
                        </div>
                        <div className="selection-status">
                            <span>เลือกแล้ว <strong>{selectedProducts.size}</strong> รายการ</span>
                            {selectedProducts.size > 0 && <button className="clear-btn" onClick={() => setSelectedProducts(new Set())}>ล้าง</button>}
                        </div>
                    </div>
                ) : (
                    /* MANUAL MODE UI */
                    <div className="selection-area" style={{ padding: '16px' }}>
                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>เพิ่มรายการใหม่</h3>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#4b5563' }}>หมวดหมู่ (หัวกระดาษ)</label>
                                <input
                                    list="category-suggestions"
                                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                    value={manualForm.category}
                                    onChange={e => setManualForm({ ...manualForm, category: e.target.value })}
                                    placeholder="พิมพ์หมวดหมู่..."
                                />
                                <datalist id="category-suggestions">
                                    <option value="สินค้าทั่วไป" />
                                    <option value="ขายดี" />
                                    <option value="แนะนำ" />
                                    <option value="โปรโมชั่น" />
                                    <option value="เครื่องดื่ม" />
                                    <option value="ขนม" />
                                    <option value="ของใช้" />
                                </datalist>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#4b5563' }}>ราคา</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={manualForm.price}
                                        onChange={e => setManualForm({ ...manualForm, price: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#4b5563' }}>จำนวน</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={manualForm.count}
                                        onChange={e => setManualForm({ ...manualForm, count: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Button onClick={addManualItem} disabled={!manualForm.price} className="w-full">
                                เพิ่มรายการ (+ Add)
                            </Button>
                        </div>

                        {/* Manual Items List */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>รายการที่เพิ่ม ({manualItems.length})</h3>
                                {manualItems.length > 0 && (
                                    <button onClick={() => setManualItems([])} style={{ color: '#ef4444', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        ล้างทั้งหมด
                                    </button>
                                )}
                            </div>

                            {manualItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
                                    ยังไม่มีรายการที่เพิ่ม
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {manualItems.map((item, index) => (
                                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.category}</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>฿{item.price}</div>
                                            </div>
                                            <button
                                                onClick={() => removeManualItem(index)}
                                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="settings-panel">
                    <h3>ตั้งค่าการพิมพ์</h3>

                    <div className="settings-grid">
                        <div className="setting-box">
                            <label>รูปแบบป้าย</label>
                            <select value={template} onChange={e => setTemplate(e.target.value)}>
                                <option value="standard">🏷️ ป้ายราคาปกติ (Standard)</option>
                                <option value="sale">🔥 ป้ายลดราคา (Sale Tag)</option>
                                <option value="minimal">🔹 ป้ายเล็ก (Minimal)</option>
                            </select>
                        </div>

                        <div className="setting-box">
                            <label>จัดหน้ากระดาษ</label>
                            <select value={paperSize} onChange={e => setPaperSize(e.target.value)}>
                                <option value="a4-3x7">📄 A4 (21 ดวง - 3x7)</option>
                                <option value="a4-4x10">📄 A4 เล็ก (40 ดวง - 4x10)</option>
                                <option value="a4-5.5x3.5">📏 A4 (3x8 - 5.5x3.5cm)</option>
                                <option value="single">🖨️ เครื่องพิมพ์สลิป (Single)</option>
                            </select>
                        </div>
                    </div>

                    <label className="checkbox-option">
                        <input
                            type="checkbox"
                            checked={showBarcode}
                            onChange={e => setShowBarcode(e.target.checked)}
                        />
                        <span>แสดงรหัสสินค้า / บาร์โค้ด</span>
                    </label>

                    <Button
                        onClick={handlePrint}
                        disabled={productsToPrint.length === 0}
                        className="print-btn"
                    >
                        <Printer size={20} /> พิมพ์ป้ายราคา ({productsToPrint.length})
                    </Button>
                </div>
            </div>

            {/* PRINT PREVIEW AREA - VISIBLE ONLY IN PRINT OR PREVIEW */}
            <div className={`preview-viewport paper-${paperSize}`}>
                <div className="preview-header">
                    <h2>ตัวอย่างก่อนพิมพ์ (Print Preview)</h2>
                    <div className="preview-tips">
                        * กด Ctrl+P เพื่อสั่งพิมพ์
                    </div>
                </div>

                <div className="paper-sheet">
                    <div className="print-grid">
                        {productsToPrint.map((product, index) => (
                            <div key={`${product.id}-${index}`} className={`label-card template-${template}`}>
                                {template === 'sale' && <div className="sale-sticker">SALE</div>}

                                <div className="label-top">
                                    <span className="label-cat">{product.category}</span>
                                </div>

                                <div className="label-main">
                                    {/* Only show name if it exists (manual items might not have one) */}
                                    {product.name && (
                                        <div className="label-title">
                                            {product.name}
                                        </div>
                                    )}
                                    <div className="label-price-box">
                                        <span className="currency">฿</span>
                                        <span className="amount">{Number(product.price).toLocaleString()}</span>
                                        <span className="label-unit">/ {product.unit || 'ชิ้น'}</span>
                                    </div>
                                </div>

                                {showBarcode && product.barcode && (
                                    <div className="label-btm">
                                        <span className="sku-code">{product.barcode}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriceLabelPrinting;
