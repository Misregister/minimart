import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import { useProduct } from '../../contexts/ProductContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { CATEGORY_LIST } from '../../services/mockData';
import { Save, RefreshCw, Link, Trash2 } from '../common/Icons';
import { Scan } from 'lucide-react';
import CameraCapture from '../common/CameraCapture';
import BarcodeScannerModal from '../common/BarcodeScannerModal';
import { fetchProductImage } from '../../services/imageFetcher';
import './ProductForm.css';

const INITIAL_FORM_STATE = {
    name: '',
    barcode: '',
    price: '',
    fullPrice: '',
    cost: '',
    stock: 0,
    category: CATEGORY_LIST[0].label,
    unit: 'Piece',
    packSize: 1,
    packPrice: '',
    minStock: 5,
    zone: '',
    image: null,
    showInPOS: false,
    packBarcode: '',
    caseBarcode: '',
    caseSize: 1,
    casePrice: '',
    showInStore: false,
    isRecommended: false,
    isHero: false
};


const ProductForm = ({ product, initialData, onClose, isQuickAdd = false, onSuccess, onDelete }) => {
    // DEBUG: Trace Props
    console.log("ProductForm Rendered. Product:", product ? `ID: ${product?.id} (${product?.name})` : "NULL (Add Mode)");

    const { addProduct, updateProduct, products } = useProduct(); // Destructure products for validation
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(INITIAL_FORM_STATE);
    const [scannerField, setScannerField] = useState(null); // 'packBarcode' | 'caseBarcode'


    useEffect(() => {
        console.log('ProductForm received product:', product);
        if (product) {
            setFormData({
                ...INITIAL_FORM_STATE,
                ...product,
                // Explicitly preserve ID in formData for safety
                id: product.id,
                // Default to FALSE (Unchecked) if undefined/null
                showInPOS: product.showInPOS === true ? true : false,
                showInStore: product.showInStore === true ? true : false,
                isRecommended: product.isRecommended === true ? true : false,
                isHero: product.isHero === true ? true : false,
                fullPrice: product.fullPrice || ''
            });
        } else if (initialData) {
            setFormData({
                ...INITIAL_FORM_STATE,
                ...initialData
            });
        }
    }, [product, initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // console.log("Form change:", name, type, value, checked); // Debugging
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: type === 'checkbox'
                    ? checked
                    : (name === 'stock' || name === 'packSize' || name === 'caseSize' || name === 'minStock')
                        ? parseInt(value) || 0
                        : (name === 'price' || name === 'cost' || name === 'packPrice' || name === 'casePrice' || name === 'fullPrice')
                            ? parseFloat(value) || 0
                            : value
            };



            return newData;
        });
    };

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: !!checked
        }));
    };

    const handleImageCapture = (imageData) => {
        setFormData(prev => ({ ...prev, image: imageData }));
    };

    const handleScan = (code) => {
        if (scannerField) {
            setFormData(prev => ({ ...prev, [scannerField]: code }));
            setScannerField(null); // Close scanner on success
        }
    };

    const handleAutoFetchImage = async () => {
        if (!formData.barcode && !formData.name) {
            alert('กรุณาใส่บาร์โค้ดหรือชื่อสินค้าก่อน');
            return;
        }

        setIsSubmitting(true);
        try {
            const imageUrl = await fetchProductImage({
                barcode: formData.barcode,
                packBarcode: formData.packBarcode,
                name: formData.name
            });

            if (imageUrl) {
                setFormData(prev => ({ ...prev, image: imageUrl }));
                alert('พบรูปภาพแล้ว!');
            } else {
                alert('ไม่พบรูปภาพ กรุณาถ่ายรูปหรือใส่ URL เอง');
            }
        } catch (error) {
            console.error('Error fetching image:', error);
            alert('เกิดข้อผิดพลาดในการค้นหารูป');
        } finally {
            setIsSubmitting(false);
        }
    };


    // STRICT SEPARATION: Handle Update
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        // VERIFY ID
        const editId = product?.id || formData.id;
        if (!editId) {
            alert("Critical Error: Missing Product ID for Update. Please close and try again.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Trim inputs
            const trimmedBarcode = String(formData.barcode).trim();
            const trimmedPackBarcode = formData.packBarcode ? String(formData.packBarcode).trim() : '';
            const trimmedCaseBarcode = formData.caseBarcode ? String(formData.caseBarcode).trim() : '';

            // Check for duplicate barcode (String comparison) - EXCLUDING SELF
            const duplicate = products.find(p => {
                if (p.id === editId) return false; // Ignore self

                const pBarcode = String(p.barcode || '').trim();
                const pPackBarcode = String(p.packBarcode || '').trim();
                const pCaseBarcode = String(p.caseBarcode || '').trim();

                const mainConflict = (pBarcode === trimmedBarcode) ||
                    (pPackBarcode && pPackBarcode === trimmedBarcode) ||
                    (pCaseBarcode && pCaseBarcode === trimmedBarcode);

                let packConflict = false;
                if (trimmedPackBarcode) {
                    packConflict = (pBarcode === trimmedPackBarcode) ||
                        (pPackBarcode && pPackBarcode === trimmedPackBarcode) ||
                        (pCaseBarcode && pCaseBarcode === trimmedPackBarcode);
                }

                let caseConflict = false;
                if (trimmedCaseBarcode) {
                    caseConflict = (pBarcode === trimmedCaseBarcode) ||
                        (pPackBarcode && pPackBarcode === trimmedCaseBarcode) ||
                        (pCaseBarcode && pCaseBarcode === trimmedCaseBarcode);
                }
                return mainConflict || packConflict || caseConflict;
            });

            if (duplicate) {
                alert(t('barcodeExists') || `Product with this barcode already exists: ${duplicate.name}`);
                setIsSubmitting(false);
                return;
            }

            // Sanitize formData
            const sanitizedData = Object.fromEntries(
                Object.entries(formData).filter(([_, v]) => v !== undefined)
            );
            sanitizedData.barcode = trimmedBarcode;
            if (trimmedPackBarcode) sanitizedData.packBarcode = trimmedPackBarcode;
            if (trimmedCaseBarcode) sanitizedData.caseBarcode = trimmedCaseBarcode;

            // Remove id from data to prevent conflicts
            const { id, ...dataWithoutId } = sanitizedData;

            // DEBUG ALERT - REMOVE LATER
            // const confirmUpdate = window.confirm(`DEBUG: กำลังจะอัพเดทสินค้า ID: ${editId}\nกด OK เพื่อยืนยันการอัพเดท\n(จะไม่สร้างใหม่แน่นอน)`);
            // if (!confirmUpdate) {
            //     setIsSubmitting(false);
            //     return;
            // }

            console.log('EXECUTING UPDATE for ID:', editId);
            await updateProduct(editId, dataWithoutId);
            // alert("อัพเดทเสร็จสิ้น! (กรุณาเช็คว่ามีรายการซ้ำหรือไม่)");
            onClose();

        } catch (error) {
            console.error("Error updating product:", error);
            alert(`Failed to update: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // STRICT SEPARATION: Handle Create
    const handleCreate = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        // DEBUG ALERT
        /*
        const confirmCreate = window.confirm("DEBUG: กำลังจะสร้างสินค้าใหม่ (New Create)\nกด OK เพื่อยืนยัน");
        if (!confirmCreate) {
             setIsSubmitting(false);
             return;
        }
        */

        setIsSubmitting(true);
        try {
            // Trim inputs
            const trimmedBarcode = String(formData.barcode).trim();
            const trimmedPackBarcode = formData.packBarcode ? String(formData.packBarcode).trim() : '';
            const trimmedCaseBarcode = formData.caseBarcode ? String(formData.caseBarcode).trim() : '';

            // Check for duplicate barcode (Global)
            const duplicate = products.find(p => {
                const pBarcode = String(p.barcode || '').trim();
                const pPackBarcode = String(p.packBarcode || '').trim();
                const pCaseBarcode = String(p.caseBarcode || '').trim();

                const mainConflict = (pBarcode === trimmedBarcode) ||
                    (pPackBarcode && pPackBarcode === trimmedBarcode) ||
                    (pCaseBarcode && pCaseBarcode === trimmedBarcode);

                let packConflict = false;
                if (trimmedPackBarcode) {
                    packConflict = (pBarcode === trimmedPackBarcode) ||
                        (pPackBarcode && pPackBarcode === trimmedPackBarcode) ||
                        (pCaseBarcode && pCaseBarcode === trimmedPackBarcode);
                }

                let caseConflict = false;
                if (trimmedCaseBarcode) {
                    caseConflict = (pBarcode === trimmedCaseBarcode) ||
                        (pPackBarcode && pPackBarcode === trimmedCaseBarcode) ||
                        (pCaseBarcode && pCaseBarcode === trimmedCaseBarcode);
                }
                return mainConflict || packConflict || caseConflict;
            });

            if (duplicate) {
                alert(t('barcodeExists') || `Product with this barcode already exists: ${duplicate.name}`);
                setIsSubmitting(false);
                return;
            }

            // Sanitize formData
            const sanitizedData = Object.fromEntries(
                Object.entries(formData).filter(([_, v]) => v !== undefined)
            );
            sanitizedData.barcode = trimmedBarcode;
            if (trimmedPackBarcode) sanitizedData.packBarcode = trimmedPackBarcode;
            if (trimmedCaseBarcode) sanitizedData.caseBarcode = trimmedCaseBarcode;

            // Remove any accidental id from data
            delete sanitizedData.id;

            console.log('EXECUTING CREATE');
            const newProduct = await addProduct(sanitizedData);
            if (onSuccess) onSuccess(newProduct);
            onClose();

        } catch (error) {
            console.error("Error creating product:", error);
            alert(`Failed to create: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="product-form" onSubmit={(e) => e.preventDefault()}>
            <BarcodeScannerModal
                isOpen={!!scannerField}
                onClose={() => setScannerField(null)}
                onScan={handleScan}
            />

            <div className={`form-grid ${isQuickAdd ? 'quick-add-mode' : ''}`}>
                <div className="form-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>{isQuickAdd ? t('quickAdd') : t('basicInfo')}</h3>
                        {product && (
                            <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                background: '#fef3c7',
                                color: '#d97706',
                                borderRadius: '4px',
                                border: '1px solid #fcd34d',
                                fontWeight: 'bold'
                            }}>
                                EDIT MODE: {product.id}
                            </span>
                        )}
                    </div>

                    {!isQuickAdd && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <CameraCapture onCapture={handleImageCapture} initialImage={formData.image} />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleAutoFetchImage}
                                    disabled={isSubmitting || (!formData.barcode && !formData.name)}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <RefreshCw size={16} /> รับจากคลัง
                                </Button>
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <Input
                                    label="ลิ้งค์รูปภาพ (URL)"
                                    name="image"
                                    value={formData.image || ''}
                                    onChange={handleChange}
                                    placeholder="https://example.com/image.jpg"
                                    icon={Link}
                                />
                            </div>
                        </div>
                    )}
                    <Input label={t('productName')} name="name" value={formData.name} onChange={handleChange} required autoFocus />
                    <Input label={t('barcode')} name="barcode" value={formData.barcode} onChange={handleChange} required />

                    <div className="input-group">
                        <div className="input-wrapper">
                            <label className="input-label">{t('category')}</label>
                            <input
                                className="input-field"
                                list="category-options"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                placeholder={t('selectOrTypeCategory') || "Select or type..."}
                            />
                            <datalist id="category-options">
                                {CATEGORY_LIST.map(cat => (
                                    <option key={cat.id} value={cat.label} />
                                ))}
                            </datalist>
                        </div>
                        {!isQuickAdd && <Input label={t('zoneShelf')} name="zone" value={formData.zone} onChange={handleChange} placeholder="e.g. Fridge 1" />}
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('pricingStock')}</h3>
                    <div className="input-group">
                        {!isQuickAdd && <Input label={t('costPrice')} type="number" step="0.01" name="cost" value={formData.cost} onChange={handleChange} />}
                        <Input label={t('sellingPrice')} type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required />
                        {!isQuickAdd && <Input label="ราคาเต็ม (ก่อนลด)" type="number" step="0.01" name="fullPrice" value={formData.fullPrice} onChange={handleChange} placeholder="ใส่เพื่อโชว์ขีดฆ่า" />}
                    </div>
                    {!isQuickAdd && (
                        <div className="input-group">
                            <Input label={t('currentStock')} type="number" name="stock" value={formData.stock} onChange={handleChange} />
                            <Input label={t('minStockAlert')} type="number" name="minStock" value={formData.minStock} onChange={handleChange} />
                        </div>
                    )}
                </div>

                {!isQuickAdd && (
                    <>
                        <div className="form-section full-width">
                            <h3>{t('unitConversion')}</h3>
                            <div className="unit-conversion-box">
                                <div className="conversion-row">
                                    <span>1 {t('packUnit')}</span>
                                    <span>=</span>
                                    <Input
                                        wrapperClassName="small-input"
                                        type="number"
                                        name="packSize"
                                        value={formData.packSize}
                                        onChange={handleChange}
                                        label={t('packSize')}
                                    />
                                    <Input
                                        wrapperClassName="small-input"
                                        name="packBarcode"
                                        value={formData.packBarcode || ''}
                                        onChange={handleChange}
                                        label={t('packBarcode') || "Barcode (Pack)"}
                                        placeholder={t('scanCarton') || "Scan Box"}
                                        icon={Scan}
                                        onIconClick={() => setScannerField('packBarcode')}
                                    />
                                    <span style={{ marginTop: '1.5rem' }}>{t('pieces')} ({formData.unit})</span>
                                </div>

                                <div className="conversion-row" style={{ marginTop: '1rem' }}>
                                    <Input
                                        label={t('singleUnitName')}
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        placeholder="e.g. Bottle"
                                    />
                                    <Input
                                        label={t('packSellingPrice')}
                                        type="number"
                                        name="packPrice"
                                        value={formData.packPrice}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="conversion-row" style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                    <span>1 {t('caseUnit') || 'ลัง'}</span>
                                    <span>=</span>
                                    <Input
                                        wrapperClassName="small-input"
                                        type="number"
                                        name="caseSize"
                                        value={formData.caseSize}
                                        onChange={handleChange}
                                        label={t('caseSize') || "จำนวนต่อลัง"}
                                    />
                                    <Input
                                        wrapperClassName="small-input"
                                        name="caseBarcode"
                                        value={formData.caseBarcode || ''}
                                        onChange={handleChange}
                                        label={t('caseBarcode') || "Barcode (Case)"}
                                        placeholder={t('scanCarton') || "Scan Case"}
                                        icon={Scan}
                                        onIconClick={() => setScannerField('caseBarcode')}
                                    />
                                    <Input
                                        label={t('caseSellingPrice') || "ราคาต่อลัง"}
                                        type="number"
                                        name="casePrice"
                                        value={formData.casePrice}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>




                        <div className="form-section full-width">
                            <h3>{t('visibilitySettings')}</h3>
                            <div className="visibility-toggles">
                                <label className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        name="showInPOS"
                                        checked={!!formData.showInPOS}
                                        onChange={handleCheckboxChange}
                                    />
                                    <span>{t('showInPOS')}</span>
                                </label>

                                <label className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        name="showInStore"
                                        checked={!!formData.showInStore}
                                        onChange={handleCheckboxChange}
                                    />
                                    <span>{t('showInStore') || 'เปิดขายออนไลน์'}</span>
                                </label>
                                <label className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        name="isHero"
                                        checked={!!formData.isHero}
                                        onChange={handleCheckboxChange}
                                    />
                                    <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                                        ⭐ {t('isHero') || 'สินค้าแนะนำ (แสดงหน้าแรก)'}
                                    </span>
                                </label>
                                <label className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        name="isRecommended"
                                        checked={!!formData.isRecommended}
                                        onChange={handleCheckboxChange}
                                    />
                                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                        ✅ {t('isRecommended') || 'แสดงในหมวดหมู่'}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="form-actions">
                <Button variant="outline" type="button" onClick={onClose}>{t('cancel')}</Button>
                {product && onDelete && (
                    <Button
                        type="button"
                        icon={Trash2}
                        onClick={() => {
                            // Don't confirm here if handleDelete already confirms, but Inventory logic checks window.confirm.
                            // However, better to rely on parent or invoke it directly.
                            // The parent's handleDelete does window.confirm.
                            onDelete(product.id);
                            onClose();
                        }}
                        style={{ background: '#ef4444', borderColor: '#ef4444', color: 'white' }}
                    >
                        {t('delete') || 'ลบสินค้า'}
                    </Button>
                )}
                {product ? (
                    <Button
                        type="button"
                        icon={Save}
                        isLoading={isSubmitting}
                        disabled={isSubmitting}
                        onClick={handleUpdate}
                        style={{ background: '#f59e0b', borderColor: '#f59e0b' }} // Orange for Edit
                    >
                        {t('updateProduct') || 'บันทึกแก้ไข'}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        icon={Save}
                        isLoading={isSubmitting}
                        disabled={isSubmitting}
                        onClick={handleCreate}
                        style={{ background: '#10b981', borderColor: '#10b981' }} // Green for Add
                    >
                        {t('addProduct') || 'เพิ่มสินค้า'}
                    </Button>
                )}
            </div>
        </form >
    );
};

export default ProductForm;
