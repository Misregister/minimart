import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProduct } from '../contexts/ProductContext';
import { useLanguage } from '../contexts/LanguageContext';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import ProductForm from '../components/inventory/ProductForm';
import ImportPreviewModal from '../components/inventory/ImportPreviewModal';
import ReceiveStockModal from '../components/inventory/ReceiveStockModal';
import WithdrawalModal from '../components/inventory/WithdrawalModal';
import PhotoReceiveStock from '../components/inventory/PhotoReceiveStock';
import BarcodeScannerModal from '../components/common/BarcodeScannerModal';
import { Search, Plus, Edit, Trash2, Package, Download, Upload, PackagePlus, Camera, ChevronLeft, ChevronRight, QrCode, LogOut, Image as ImageIcon, RefreshCw, Monitor, Snowflake, Printer, Star } from '../components/common/Icons';
import { exportToCSV, parseCSV } from '../services/csvUtils';
import { CATEGORY_LIST } from '../services/mockData';
import { useDebounce } from '../hooks/useDebounce';
import './Inventory.css';

const Inventory = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { products, deleteProduct, addProduct, updateProduct, bulkUpdateVisibilityByImage, resetShowInStore } = useProduct();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productFormInitialData, setProductFormInitialData] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [receivingProduct, setReceivingProduct] = useState(null);
    const [withdrawingProduct, setWithdrawingProduct] = useState(null);
    const [isPhotoReceiveOpen, setIsPhotoReceiveOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isBulkRestocking, setIsBulkRestocking] = useState(false);
    const [bulkRestockQty, setBulkRestockQty] = useState('');
    const [isBulkRestockOpen, setIsBulkRestockOpen] = useState(false);
    const [showNoCostOnly, setShowNoCostOnly] = useState(false);

    // Auto Fetch State - REMOVED


    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const fileInputRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    const filteredProducts = useMemo(() => {
        return Array.isArray(products) ? products.filter(product => {
            if (!product) return false;
            try {
                const name = String(product.name || '').toLowerCase();
                const barcode = String(product.barcode || '').toLowerCase();
                const packBarcode = String(product.packBarcode || '').toLowerCase();
                const searchLower = String(debouncedSearchTerm || '').toLowerCase();

                const matchesSearch = name.includes(searchLower) || barcode.includes(searchLower) || packBarcode.includes(searchLower);
                const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;

                let matchesCost = true;
                if (showNoCostOnly) {
                    matchesCost = !product.cost || Number(product.cost) === 0;
                }

                return matchesSearch && matchesCategory && matchesCost;
            } catch (e) {
                console.warn("Error filtering product:", product, e);
                return false;
            }
        }) : [];
    }, [products, debouncedSearchTerm, selectedCategory, showNoCostOnly]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);




    const handleEdit = (product) => {
        console.log('Editing product:', product, 'ID:', product?.id);
        setEditingProduct(product);
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm(t('deleteConfirm'))) {
            deleteProduct(id);
        }
    };



    const handleAddNew = () => {
        setEditingProduct(null);
        setProductFormInitialData(null);
        setIsFormOpen(true);
    };

    const handleExport = () => {
        exportToCSV(products, `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const parsedData = await parseCSV(file);
            // Pre-process mapping for User's specific CSV format
            const mappedData = parsedData.map(item => {
                const imageKeys = ['image', 'image_url', 'img', 'photo', 'pic', 'picture'];
                const foundImageKey = imageKeys.find(key => key in item);

                const mapped = {
                    ...item,
                    barcode: item.main_barcode || item.barcode || '',
                    packBarcode: item.pack_code || item.packBarcode || '',
                    packSize: parseFloat(item.pack_qty || item.packSize || 1),
                    caseBarcode: item.case_code || item.caseBarcode || '',
                    caseSize: parseFloat(item.case_qty || item.caseSize || 1),
                    name: item.name || `Imported ${item.main_barcode || item.barcode || 'Product'}`,
                };

                // Only include image if a column was actually present
                if (foundImageKey) {
                    mapped.image = item[foundImageKey];
                }

                // Check for existing product to determine status
                const existing = products.find(p => String(p.barcode) === String(mapped.barcode));
                mapped._status = existing ? 'Update' : 'New';
                mapped._existingId = existing?.id;

                return mapped;
            });
            setPreviewData(mappedData);
            setIsPreviewOpen(true);
        } catch (error) {
            console.error('Import Error:', error);
            alert(t('importFailed'));
        }
        e.target.value = '';
    };

    const handleImportConfirm = (finalData) => {
        let count = 0;
        finalData.forEach(product => {
            // Strip internal fields used for preview
            const { _status, _existingId, _tempId, ...cleanProduct } = product;

            // Critical: If it's an update, we want to ensure we use the existing ID if available, 
            // OR let the barcode matcher find it. 
            // If cleanProduct.id is a random ID generated by parseCSV, remove it so addProduct doesn't get confused.
            if (_status === 'Update' && _existingId) {
                cleanProduct.id = _existingId;
            } else if (_status === 'New') {
                // Remove random ID from parseCSV so Firestore generates a proper one
                delete cleanProduct.id;
            }

            if (cleanProduct.name && cleanProduct.barcode) {
                addProduct({
                    ...cleanProduct
                });
                count++;
            }
        });
        setIsPreviewOpen(false);
        alert(t('importSuccess').replace('{count}', count));
        setPreviewData([]);
    };

    const handleBulkRestock = async () => {
        const qty = parseInt(bulkRestockQty);
        if (!qty || qty <= 0) {
            alert('กรุณาใส่จำนวนที่ถูกต้อง');
            return;
        }
        if (!window.confirm(`ยืนยัน: เพิ่มสต๊อกสินค้าทุกชิ้น +${qty} (${products.length} รายการ)?`)) return;

        setIsBulkRestocking(true);
        try {
            const { supabase } = await import('../services/supabase');
            // Supabase doesn't have a direct "increment" for bulk update easily without RPC 
            // but we can do it in rounds or a simple loop if count is reasonable.
            // For a better approach, we'll iterate and update using the existing context method.
            
            for (const product of products) {
                const newStock = (product.stock || 0) + qty;
                await updateProduct(product.id, { stock: newStock });
            }

            alert(`✅ เพิ่มสต๊อก +${qty} ให้สินค้า ${products.length} รายการ เรียบร้อย!`);
            setIsBulkRestockOpen(false);
            setBulkRestockQty('');
        } catch (error) {
            console.error('Bulk restock error:', error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setIsBulkRestocking(false);
        }
    };


    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <div className="search-wrapper">
                    <Input
                        ref={searchInputRef}
                        placeholder={t('searchProduct')}
                        icon={Search}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                    <Button variant="ghost" onClick={() => setIsScannerOpen(true)} title={t('scanBarcode')}>
                        <QrCode size={20} />
                    </Button>
                    <select
                        className="input-field"
                        style={{ maxWidth: '180px', cursor: 'pointer', marginLeft: '0.5rem' }}
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="All">📁 ทุกหมวดหมู่</option>
                        {CATEGORY_LIST.map(cat => (
                            <option key={cat.id} value={cat.label}>
                                {cat.icon} {cat.label}
                            </option>
                        ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', marginLeft: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                        <input 
                            type="checkbox" 
                            checked={showNoCostOnly} 
                            onChange={(e) => setShowNoCostOnly(e.target.checked)} 
                            style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
                        />
                        <span style={{ whiteSpace: 'nowrap' }}>ขาดต้นทุน</span>
                    </label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>


                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" style={{ display: 'none' }} />


                    {/* Extra Actions Dropdown or just buttons for now */}

                    <Button variant="outline" onClick={() => navigate('/print-labels')} title={t('printLabels')}>
                        <Printer size={18} /> {t('printLabels')}
                    </Button>


                    <Button variant="outline" onClick={() => setIsPhotoReceiveOpen(true)}>
                        <Camera size={18} /> ถ่ายบิล
                    </Button>
                    <Button variant="outline" onClick={handleImportClick}>
                        <Upload size={18} /> {t('import')}
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                        <Download size={18} /> {t('export')}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setIsBulkRestockOpen(true)}
                        style={{ background: '#ecfdf5', borderColor: '#10b981', color: '#059669' }}
                    >
                        <PackagePlus size={18} /> เพิ่มสต๊อกทั้งหมด
                    </Button>

                    <Button onClick={handleAddNew}>
                        <Plus size={18} /> {t('addProduct')}
                    </Button>
                </div>
            </div>

            <div className="product-list">
                {filteredProducts.length === 0 ? (
                    <div className="empty-state">
                        <Package size={48} />
                        <p>{t('noData')}</p>
                        {searchTerm && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    setEditingProduct(null); // Ensure not edit mode
                                    setIsFormOpen(true);
                                    // We need to pass initial data, but setIsFormOpen just opens the modal. 
                                    // I need to store initialData in state or pass it to ProductForm via a new state.
                                    setProductFormInitialData({ barcode: searchTerm, showInPOS: false });
                                }}
                                style={{ marginTop: '1rem' }}
                            >
                                <Plus size={16} /> {t('quickAdd')} "{searchTerm}"
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="product-table">
                            <thead>
                                <tr>
                                    <th>{t('productName')}</th>
                                    <th>{t('barcode')}</th>
                                    <th>{t('category')}</th>
                                    <th>{t('price')}</th>
                                    <th>{t('stock')}</th>
                                    <th style={{ textAlign: 'center' }}>POS</th>
                                    <th style={{ textAlign: 'center' }}>Store</th>
                                    <th style={{ textAlign: 'center' }}>แนะนำ</th>
                                    <th>{t('zone')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map(product => (
                                    <tr key={product.id}>
                                        <td>
                                            <div className="product-name-cell">
                                                {product.image && <img src={product.image} alt={product.name} className="product-thumb" />}
                                                <div>
                                                    <p className="font-medium">{product.name}</p>
                                                    <p className="text-sm text-secondary">{product.unit}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{product.barcode}</td>
                                        <td>
                                            <select
                                                className="badge-select"
                                                value={product.category}
                                                onChange={(e) => {
                                                    if (window.confirm(`Change category to ${e.target.value}?`)) {
                                                        updateProduct(product.id, { category: e.target.value });
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {CATEGORY_LIST.map(cat => (
                                                    <option key={cat.id} value={cat.label}>
                                                        {cat.icon} {cat.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>฿ {Number(product.price || 0).toFixed(2)}</td>
                                        <td>
                                            <span className={`stock-badge ${(product.stock || 0) <= (product.minStock || 5) ? 'low-stock' : ''}`}>
                                                {product.stock || 0}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!product.showInPOS}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                onChange={(e) => {
                                                    updateProduct(product.id, {
                                                        showInPOS: e.target.checked
                                                    });
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!product.showInStore}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                onChange={(e) => {
                                                    updateProduct(product.id, {
                                                        showInStore: e.target.checked
                                                    });
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateProduct(product.id, { isRecommended: !product.isRecommended });
                                                }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: product.isRecommended ? '#fbbf24' : '#e5e7eb',
                                                    padding: '4px'
                                                }}
                                                title={product.isRecommended ? "เลิกแนะนำ" : "ตั้งเป็นสินค้าแนะนำ"}
                                            >
                                                <Star size={20} fill={product.isRecommended ? "currentColor" : "none"} />
                                            </button>
                                        </td>
                                        <td>{product.zone || '-'}</td>
                                        <td>
                                            <div className="action-buttons">

                                                <Button variant="ghost" size="sm" className="text-success" onClick={() => setReceivingProduct(product)} title="รับสินค้าเข้า">
                                                    <PackagePlus size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-warning" onClick={() => setWithdrawingProduct(product)} title="เบิกออก (ไม่คิดเงิน)">
                                                    <LogOut size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                                                    <Edit size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(product.id)}>
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {filteredProducts.length > 0 && (
                <div className="pagination-controls" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {t('showing')} {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} {t('of')} {filteredProducts.length}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <span style={{ margin: '0 0.5rem', fontWeight: 500 }}>
                            {t('page')} {currentPage} {t('of')} {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingProduct ? t('editProduct') : t('addProduct')}
                size="lg"
            >
                <ProductForm
                    product={editingProduct}
                    initialData={productFormInitialData}
                    onClose={() => {
                        setIsFormOpen(false);
                        setProductFormInitialData(null);
                    }}
                    onSuccess={() => {
                        setSearchTerm('');
                        // searchInputRef.current?.focus(); 
                    }}
                    onDelete={handleDelete} // Pass delete handler
                />
            </Modal>

            <ImportPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                data={previewData}
                onConfirm={handleImportConfirm}
            />

            <ReceiveStockModal
                isOpen={!!receivingProduct}
                onClose={() => setReceivingProduct(null)}
                product={receivingProduct}
            />

            <WithdrawalModal
                isOpen={!!withdrawingProduct}
                onClose={() => setWithdrawingProduct(null)}
                product={withdrawingProduct}
            />

            <PhotoReceiveStock
                isOpen={isPhotoReceiveOpen}
                onClose={() => setIsPhotoReceiveOpen(false)}
                onScanComplete={(data) => {
                    setIsPhotoReceiveOpen(false);
                    setPreviewData(data);
                    setIsPreviewOpen(true);
                }}
            />

            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={(code) => {
                    setSearchTerm(code);
                    setIsScannerOpen(false);
                }}
            />

            {/* Bulk Restock Modal */}
            <Modal isOpen={isBulkRestockOpen} onClose={() => setIsBulkRestockOpen(false)} title="📦 เพิ่มสต๊อกสินค้าทั้งหมด" size="sm">
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>สินค้าทั้งหมด: {products.length} รายการ</p>
                        <p style={{ margin: '0.25rem 0 0', color: '#15803d', fontSize: '0.9rem' }}>จำนวนที่ใส่จะถูก +เพิ่ม ให้สินค้าทุกชิ้นพร้อมกัน</p>
                    </div>
                    <Input
                        label="จำนวนที่ต้องการเพิ่ม (ทุกรายการ)"
                        type="number"
                        value={bulkRestockQty}
                        onChange={(e) => setBulkRestockQty(e.target.value)}
                        placeholder="เช่น 10, 50, 100"
                        autoFocus
                        style={{ fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[10, 20, 50, 100].map(q => (
                            <button
                                key={q}
                                onClick={() => setBulkRestockQty(String(q))}
                                style={{
                                    flex: 1, padding: '0.75rem', border: '1px solid #d1d5db',
                                    borderRadius: '8px', background: bulkRestockQty === String(q) ? '#10b981' : 'white',
                                    color: bulkRestockQty === String(q) ? 'white' : '#374151',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
                                }}
                            >+{q}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button variant="outline" onClick={() => setIsBulkRestockOpen(false)} style={{ flex: 1 }}>ยกเลิก</Button>
                        <Button
                            onClick={handleBulkRestock}
                            disabled={isBulkRestocking || !bulkRestockQty}
                            style={{ flex: 2, background: '#10b981', borderColor: '#10b981' }}
                        >
                            {isBulkRestocking ? 'กำลังอัพเดท...' : `✅ เพิ่มสต๊อก +${bulkRestockQty || 0} ทุกรายการ`}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Inventory;
