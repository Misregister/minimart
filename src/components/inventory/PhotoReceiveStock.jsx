import React, { useState, useRef, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { useProduct } from '../../contexts/ProductContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Camera, Package, Plus, Calculator, Search, X, Check, Image, FileText, Loader } from 'lucide-react';
import Tesseract from 'tesseract.js';
import './PhotoReceiveStock.css';

const resizeImage = (dataUrl, maxWidth = 1000) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            if (img.width <= maxWidth && img.height <= maxWidth) {
                resolve(dataUrl);
                return;
            }
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width *= maxWidth / height;
                    height = maxWidth;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
    });
};

const PhotoReceiveStock = ({ isOpen, onClose, onScanComplete }) => {
    const { products, addStock } = useProduct();
    const { language } = useLanguage();

    const [capturedImage, setCapturedImage] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [stream, setStream] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setCapturedImage(null);
            setSelectedProducts([]);
            setSearchTerm('');
            setIsProcessing(false);
            setProgress(0);
        }
    }, [isOpen]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setShowCamera(true);
        } catch (err) {
            console.error('Camera error:', err);
            alert(language === 'th' ? 'ไม่สามารถเปิดกล้องได้' : 'Cannot access camera');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = async () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Set dimensions with a cap for OCR visibility vs data size
            const MAX_SIZE = 1200;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, width, height);

            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(imageData);
            stopCamera();
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const resized = await resizeImage(e.target.result, 1200);
                setCapturedImage(resized);
            };
            reader.readAsDataURL(file);
        }
    };

    const processImage = async () => {
        if (!capturedImage) return;

        setIsProcessing(true);
        setProgress(0);
        setStatusText(language === 'th' ? 'กำลังเริ่มต้น...' : 'Initializing...');

        try {
            const result = await Tesseract.recognize(
                capturedImage,
                'tha+eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                            setStatusText(`${language === 'th' ? 'กำลังอ่านข้อความ' : 'Reading text'}... ${Math.round(m.progress * 100)}%`);
                        } else {
                            setStatusText(m.status);
                        }
                    }
                }
            );

            const text = result.data.text;
            console.log('OCR Result:', text);
            const parsedItems = parseReceiptText(text);

            if (onScanComplete) {
                onScanComplete(parsedItems);
            }

        } catch (error) {
            console.error('OCR Error:', error);
            alert(language === 'th' ? 'เกิดข้อผิดพลาดในการอ่านรูปภาพ' : 'Error processing image');
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    };

    const parseReceiptText = (text) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const items = [];

        // Basic heuristic parser
        // Looks for lines that might be products (text followed by price/qty)
        // This is a naive implementation and would need refinement for specific receipt formats
        lines.forEach(line => {
            // Common receipt pattern: "Product Name ... 100.00" or "Product Name 2 x 50.00"
            // Try to extract price from end of line
            // Regex matches number at end of line, possibly with comma and 2 decimal places
            const priceMatch = line.match(/(\d{1,3}(,\d{3})*(\.\d{2})?)$/);

            if (priceMatch) {
                const priceStr = priceMatch[0].replace(/,/g, '');
                const price = parseFloat(priceStr);

                // Name is everything before the price
                let name = line.substring(0, line.lastIndexOf(priceMatch[0])).trim();

                // Clean up name (remove leading numbers/dots often found in lists like "1. Item")
                name = name.replace(/^\d+[\.\s]+/, '');

                if (name.length > 2 && price > 0) {
                    items.push({
                        name: name,
                        price: price, // Assuming this is price, could be total
                        stock: 1,     // Default quantity
                        barcode: '',  // Unknown
                        category: 'Uncategorized',
                        unit: 'piece'
                    });
                }
            }
        });

        // If no structured items found, maybe return the raw text lines as potential items?
        // For now, if empty, we might want to just return a dummy item with the full text to let user edit
        if (items.length === 0) {
            lines.forEach((line, index) => {
                if (line.length > 3) { // Filter out very short noise
                    items.push({
                        name: line,
                        price: 0,
                        stock: 1,
                        barcode: '',
                        category: 'Uncategorized',
                        unit: 'piece'
                    });
                }
            });
        }

        return items;
    };

    const addProductToList = (product) => {
        if (!selectedProducts.find(p => p.id === product.id)) {
            setSelectedProducts([...selectedProducts, {
                ...product,
                quantity: '',
                unit: 'pack',
                calculatedPieces: 0
            }]);
        }
        setSearchTerm('');
    };

    const updateProductQuantity = (productId, quantity, unit) => {
        setSelectedProducts(prev => prev.map(p => {
            if (p.id === productId) {
                const qty = parseFloat(quantity) || 0;
                const packSize = p.packSize || 1;
                const calculatedPieces = unit === 'pack' ? qty * packSize : qty;
                return { ...p, quantity, unit, calculatedPieces };
            }
            return p;
        }));
    };

    const removeProduct = (productId) => {
        setSelectedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const handleConfirmAll = () => {
        selectedProducts.forEach(product => {
            if (product.calculatedPieces > 0) {
                addStock(product.id, product.calculatedPieces, true);
            }
        });
        onClose();
    };

    const filteredProducts = Array.isArray(products) ? products.filter(p => {
        if (!p) return false;
        try {
            const name = String(p.name || '').toLowerCase();
            const barcode = String(p.barcode || '').toLowerCase();
            const searchLower = String(searchTerm || '').toLowerCase();
            return name.includes(searchLower) || barcode.includes(searchLower);
        } catch (e) {
            return false;
        }
    }) : [];

    const totalItems = selectedProducts.reduce((sum, p) => sum + p.calculatedPieces, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={language === 'th' ? '📸 ถ่ายบิลรับสินค้า' : '📸 Photo Receipt Import'}
            size="xl"
        >
            <div className="photo-receive-container">
                {/* Left: Photo Area */}
                <div className="photo-section">
                    {showCamera ? (
                        <div className="camera-view">
                            <video ref={videoRef} autoPlay playsInline />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            <div className="camera-controls">
                                <Button onClick={stopCamera} variant="outline">
                                    {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                </Button>
                                <Button onClick={capturePhoto} icon={Camera}>
                                    {language === 'th' ? 'ถ่ายภาพ' : 'Capture'}
                                </Button>
                            </div>
                        </div>
                    ) : capturedImage ? (
                        <div className="captured-image-container">
                            <div className="captured-image">
                                <img src={capturedImage} alt="Receipt" />
                                <button className="remove-image" onClick={() => setCapturedImage(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="process-actions">
                                {isProcessing ? (
                                    <div className="processing-state">
                                        <Loader className="animate-spin" size={24} />
                                        <span>{statusText}</span>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        className="process-btn"
                                        onClick={processImage}
                                        icon={FileText}
                                        disabled={!capturedImage}
                                    >
                                        {language === 'th' ? 'อ่านรายการสินค้า' : 'Process Receipt'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="photo-placeholder">
                            <Image size={48} />
                            <p>{language === 'th' ? 'ถ่ายรูปหรืออัพโหลดบิล' : 'Take photo or upload receipt'}</p>
                            <div className="photo-actions">
                                <Button onClick={startCamera} icon={Camera}>
                                    {language === 'th' ? 'เปิดกล้อง' : 'Open Camera'}
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                    {language === 'th' ? 'เลือกรูป' : 'Choose File'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Product Entry */}
                <div className="entry-section">
                    <div className="search-add-product">
                        <Input
                            placeholder={language === 'th' ? 'ค้นหาสินค้าเพื่อเพิ่ม...' : 'Search product to add...'}
                            icon={Search}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <div className="search-results">
                                {filteredProducts.slice(0, 5).map(product => (
                                    <div
                                        key={product.id}
                                        className="search-result-item"
                                        onClick={() => addProductToList(product)}
                                    >
                                        <div>
                                            <p className="product-name">{product.name}</p>
                                            <p className="product-info">{product.barcode} • 1 แพ็ค = {product.packSize || 1} {product.unit}</p>
                                        </div>
                                        <Plus size={20} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="selected-products-list">
                        {selectedProducts.length === 0 ? (
                            <div className="empty-list">
                                <Package size={32} />
                                <p>{language === 'th' ? 'ค้นหาและเพิ่มสินค้าที่รับเข้า' : 'Search and add products to receive'}</p>
                            </div>
                        ) : (
                            selectedProducts.map(product => (
                                <div key={product.id} className="selected-product-item">
                                    <div className="product-header">
                                        <div>
                                            <h4>{product.name}</h4>
                                            <p className="pack-info">
                                                <Calculator size={14} />
                                                1 {language === 'th' ? 'แพ็ค' : 'Pack'} = {product.packSize || 1} {product.unit}
                                            </p>
                                        </div>
                                        <button className="remove-btn" onClick={() => removeProduct(product.id)}>
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <div className="quantity-input-row">
                                        <div className="unit-toggle">
                                            <button
                                                className={product.unit === 'pack' ? 'active' : ''}
                                                onClick={() => updateProductQuantity(product.id, product.quantity, 'pack')}
                                            >
                                                {language === 'th' ? 'แพ็ค' : 'Pack'}
                                            </button>
                                            <button
                                                className={product.unit === 'piece' ? 'active' : ''}
                                                onClick={() => updateProductQuantity(product.id, product.quantity, 'piece')}
                                            >
                                                {language === 'th' ? 'ชิ้น' : 'Piece'}
                                            </button>
                                        </div>
                                        <input
                                            type="number"
                                            value={product.quantity}
                                            onChange={(e) => updateProductQuantity(product.id, e.target.value, product.unit)}
                                            placeholder="0"
                                            className="qty-input"
                                        />
                                    </div>

                                    <div className="calculation-row">
                                        <span>{language === 'th' ? 'จะเพิ่ม:' : 'Will add:'}</span>
                                        <span className="calc-value">+{product.calculatedPieces} {product.unit === 'pack' ? product.unit : ''}{language === 'th' ? ' ชิ้น' : ' pcs'}</span>
                                        <span className="new-stock">
                                            ({language === 'th' ? 'ใหม่:' : 'New:'} {product.stock + product.calculatedPieces})
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {selectedProducts.length > 0 && (
                        <div className="confirm-section">
                            <div className="total-summary">
                                <span>{language === 'th' ? 'รวมทั้งหมด:' : 'Total:'}</span>
                                <span className="total-value">+{totalItems} {language === 'th' ? 'ชิ้น' : 'pieces'}</span>
                            </div>
                            <Button
                                size="lg"
                                onClick={handleConfirmAll}
                                disabled={totalItems === 0}
                                icon={Check}
                                style={{ width: '100%' }}
                            >
                                {language === 'th' ? `ยืนยันรับเข้า ${selectedProducts.length} รายการ` : `Confirm ${selectedProducts.length} items`}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default PhotoReceiveStock;
