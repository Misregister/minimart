import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { useProduct } from '../../contexts/ProductContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Package, Plus, Calculator } from 'lucide-react';
import './ReceiveStockModal.css';

const ReceiveStockModal = ({ isOpen, onClose, product, initialUnit = 'pack' }) => {
    const { addStock } = useProduct();
    const { t, language } = useLanguage();

    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('pack'); // 'pack' or 'piece'
    const [calculatedPieces, setCalculatedPieces] = useState(0);
    const [totalBuyPrice, setTotalBuyPrice] = useState(''); // New: Total Price for this batch

    const packSize = product?.packSize || 1;

    useEffect(() => {
        if (isOpen) {
            setQuantity('');
            setTotalBuyPrice('');
            // Use passed initialUnit (default to pack usually, but can be piece)
            setUnit(initialUnit);
            setCalculatedPieces(0);
        }
    }, [isOpen, initialUnit]);

    useEffect(() => {
        const qty = parseFloat(quantity) || 0;
        if (unit === 'pack') {
            setCalculatedPieces(qty * packSize);
        } else {
            setCalculatedPieces(qty);
        }
    }, [quantity, unit, packSize]);

    // Calculate Cost Per Unit
    const costPerUnit = React.useMemo(() => {
        const total = parseFloat(totalBuyPrice) || 0;
        if (calculatedPieces > 0 && total > 0) {
            return total / calculatedPieces;
        }
        return 0;
    }, [totalBuyPrice, calculatedPieces]);

    const handleReceive = () => {
        if (calculatedPieces > 0 && product) {
            // Pass calculated cost if valid.
            // IMPORANT: calculatedPieces is already total pieces, so pass isPieces=true
            addStock(product.id, calculatedPieces, true, costPerUnit > 0 ? costPerUnit : null);
            onClose();
        }
    };

    if (!product) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={language === 'th' ? 'รับสินค้าเข้าสต๊อก' : 'Receive Stock'} size="md">
            <div className="receive-stock-container">
                {/* Product Info */}
                <div className="product-info-header">
                    <div className="product-icon">
                        <Package size={32} />
                    </div>
                    <div>
                        <h3>{product.name}</h3>
                        <p className="barcode">{product.barcode}</p>
                        <p className="current-stock">
                            {language === 'th' ? 'คงเหลือปัจจุบัน:' : 'Current Stock:'}
                            <strong> {product.stock} {product.unit}</strong>
                        </p>
                    </div>
                </div>

                {/* Pack Info */}
                <div className="pack-info-card">
                    <Calculator size={20} />
                    <div>
                        <p className="pack-label">{language === 'th' ? 'หน่วยแปลง' : 'Unit Conversion'}</p>
                        <p className="pack-value">1 {language === 'th' ? 'แพ็ค' : 'Pack'} = <strong>{packSize}</strong> {product.unit}</p>
                    </div>
                </div>

                {/* Input Section */}
                <div className="receive-input-section">
                    <div className="unit-selector">
                        <button
                            className={unit === 'pack' ? 'active' : ''}
                            onClick={() => setUnit('pack')}
                        >
                            {language === 'th' ? 'แพ็ค/ลัง' : 'Pack/Crate'}
                        </button>
                        <button
                            className={unit === 'piece' ? 'active' : ''}
                            onClick={() => setUnit('piece')}
                        >
                            {language === 'th' ? 'ชิ้นเดี่ยว' : 'Pieces'}
                        </button>
                    </div>

                    <Input
                        label={language === 'th' ? 'จำนวนที่รับเข้า' : 'Quantity to Receive'}
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={unit === 'pack' ? (language === 'th' ? 'กรอกจำนวนแพ็ค/ลัง' : 'Enter packs/crates') : (language === 'th' ? 'กรอกจำนวนชิ้น' : 'Enter pieces')}
                        autoFocus
                    />

                    {/* Total Price Input for Auto Cost Calculation */}
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                        <Input
                            label={language === 'th' ? 'ราคารวมรายการนี้ (คำนวณต้นทุน)' : 'Total Price (Auto Cost)'}
                            type="number"
                            value={totalBuyPrice}
                            onChange={(e) => setTotalBuyPrice(e.target.value)}
                            placeholder="เช่น 1200"
                        />
                        {costPerUnit > 0 && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#0369a1', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{language === 'th' ? 'ต้นทุนเฉลี่ยต่อชิ้น:' : 'Avg Cost per Unit:'}</span>
                                <strong>฿{costPerUnit.toFixed(2)} / {product.unit}</strong>
                            </div>
                        )}
                    </div>

                    {/* Calculation Preview */}
                    <div className="calculation-preview">
                        <div className="calc-row">
                            <span>{language === 'th' ? 'จะเพิ่มเข้าสต๊อก:' : 'Will add to stock:'}</span>
                            <span className="calc-result">+{calculatedPieces} {product.unit}</span>
                        </div>
                        <div className="calc-row total">
                            <span>{language === 'th' ? 'สต๊อกใหม่:' : 'New stock:'}</span>
                            <span className="calc-result">{product.stock + calculatedPieces} {product.unit}</span>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    size="lg"
                    onClick={handleReceive}
                    disabled={calculatedPieces <= 0}
                    style={{ width: '100%', marginTop: '1rem' }}
                    icon={Plus}
                >
                    {language === 'th' ? `ยืนยันรับเข้า +${calculatedPieces} ${product.unit}` : `Confirm Receive +${calculatedPieces} ${product.unit}`}
                </Button>
            </div>
        </Modal>
    );
};

export default ReceiveStockModal;
