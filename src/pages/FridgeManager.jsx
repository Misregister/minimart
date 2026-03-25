import React, { useState } from 'react';
import { useProduct } from '../contexts/ProductContext';
import { useShift } from '../contexts/ShiftContext';
import { useLanguage } from '../contexts/LanguageContext';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import { Search, MapPin, Grid, List } from 'lucide-react';
import './FridgeManager.css';

const FridgeManager = () => {
    const { products, addStock, resetProductSales } = useProduct();
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState('All');

    // Extract unique zones and sort them naturally (e.g. 1, 2, 10)
    const uniqueZones = Array.isArray(products)
        ? [...new Set(products.map(p => p.zone).filter(z => z && z !== '-' && z !== 'None'))] // Exclude '-' and 'None'
        : [];

    uniqueZones.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const zones = ['All', ...uniqueZones];

    const filteredProducts = Array.isArray(products) ? products.filter(product => {
        if (!product) return false;
        try {
            const name = String(product.name || '').toLowerCase();
            const barcode = String(product.barcode || '').toLowerCase();
            const searchLower = String(searchTerm || '').toLowerCase();

            const matchesSearch = name.includes(searchLower) || barcode.includes(searchLower);
            const matchesZone = selectedZone === 'All' || product.zone === selectedZone;

            // Logic: Include if explicitly set to be in fridge OR has a valid zone assigned
            const hasValidZone = product.zone && product.zone !== '-' && product.zone !== 'None' && product.zone !== '';
            const isVisible = product.showInFridge === true || hasValidZone; // Default to hidden unless flagged or zoned

            return matchesSearch && matchesZone && isVisible;
        } catch (e) {
            console.warn("Error filtering in FridgeManager:", product, e);
            return false;
        }
    }) : [];

    // Group by zone for the dashboard view
    const productsByZone = zones.filter(z => z !== 'All').reduce((acc, zone) => {
        acc[zone] = filteredProducts.filter(p => p.zone === zone);
        return acc;
    }, {});

    const handleRefill = (product) => {
        // Reset the sold count for this product in Firebase
        resetProductSales(product.id);
    };

    return (
        <div className="fridge-manager-container">
            <div className="manager-header">
                <div className="search-wrapper">
                    <Input
                        placeholder={t('searchProduct')}
                        icon={Search}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="zone-filters">
                    {zones.map(zone => (
                        <button
                            key={zone}
                            className={`zone-pill ${selectedZone === zone ? 'active' : ''}`}
                            onClick={() => setSelectedZone(zone)}
                        >
                            {zone}
                        </button>
                    ))}
                </div>
            </div>

            <div className="manager-content">
                {selectedZone === 'All' && !searchTerm ? (
                    // Dashboard View: Grouped by Zone
                    <div className="zone-dashboard">
                        {zones.filter(z => z !== 'All').map(zone => {
                            const zoneItems = productsByZone[zone] || [];
                            // Optional: Hide empty zones if preferred, but usually we show them
                            if (!productsByZone[zone]) return null;

                            return (
                                <div key={zone} className="zone-section">
                                    <h3 className="zone-title">
                                        <MapPin size={18} /> {zone}
                                        <span className="count-badge">{zoneItems.length} {t('itemsCount')}</span>
                                    </h3>
                                    <div className="zone-grid">
                                        {zoneItems.map(product => {
                                            const soldToday = product.soldToday || 0;
                                            const refillAmount = soldToday > 0 ? soldToday : (product.minStock || 5);

                                            return (
                                                <div key={product.id} className="stock-card">
                                                    <div className="stock-image">
                                                        {product.image ? (
                                                            <img src={product.image} alt={product.name} />
                                                        ) : (
                                                            <div className="placeholder">{product.name.charAt(0)}</div>
                                                        )}
                                                        {soldToday > 0 && (
                                                            <div className="sold-badge">{t('soldToday')} {soldToday}</div>
                                                        )}
                                                    </div>
                                                    <div className="stock-info">
                                                        <h4>{product.name}</h4>
                                                        <div className="stock-level">
                                                            <div className="level-bar-container">
                                                                <div
                                                                    className={`level-bar ${product.stock <= product.minStock ? 'low' : ''}`}
                                                                    style={{ width: `${Math.min(100, (product.stock / 50) * 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span>{product.stock} {product.unit}</span>
                                                        </div>
                                                        <button
                                                            className="refill-btn"
                                                            onClick={() => handleRefill(product)}
                                                        >
                                                            {t('refillProduct')}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // List View: Filtered Results
                    <div className="filtered-grid">
                        {filteredProducts.map(product => {
                            const soldToday = product.soldToday || 0;
                            const refillAmount = soldToday > 0 ? soldToday : (product.minStock || 5);

                            return (
                                <Card key={product.id} className="stock-item-card">
                                    <div className="item-header">
                                        <h4>{product.name}</h4>
                                        <span className="stock-badge">{product.stock}</span>
                                    </div>
                                    {soldToday > 0 && (
                                        <p className="sold-today-text">🔥 {t('soldToday')} {soldToday} {t('pieces')}</p>
                                    )}
                                    <p className="item-zone"><MapPin size={14} /> {product.zone}</p>
                                    <p className="item-price">฿ {product.price}</p>
                                    <button
                                        className="refill-btn-small"
                                        onClick={() => handleRefill(product)}
                                    >
                                        {t('refillProduct')}
                                    </button>
                                </Card>
                            );
                        })}
                        {filteredProducts.length === 0 && (
                            <div className="empty-message">{t('noData')}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FridgeManager;
