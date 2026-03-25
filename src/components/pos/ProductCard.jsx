import React, { memo } from 'react';

const ProductCard = memo(({ product, isSelected, isReorderMode, onClick, onHide, styles, className }) => {
    return (
        <div
            className={className}
            style={{
                ...styles.productCard,
                position: 'relative', // Ensure absolute positioning works
                borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
                transform: isSelected ? 'scale(0.95)' : 'scale(1)',
                boxShadow: isSelected ? '0 0 0 4px rgba(59, 130, 246, 0.3)' : 'none',
                cursor: isReorderMode ? 'move' : 'pointer',
                opacity: (isReorderMode) ? 0.7 : 1
            }}
            onClick={() => onClick(product)}
        >
            {isReorderMode && (
                <>
                    {/* Reorder Icon */}
                    <div style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        background: '#3b82f6',
                        color: 'white',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}>
                        ⇄
                    </div>
                    {/* Hide from POS Button */}
                    <div 
                        onClick={(e) => {
                            if (onHide) onHide(product, e);
                        }}
                        style={{
                            position: 'absolute',
                            top: 5,
                            left: 5,
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 11,
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                        title="ซ่อนสินค้านี้จากหน้าจอ POS"
                    >
                        ✕
                    </div>
                </>
            )}
            <div style={{ position: 'relative' }}>
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        style={styles.productImage}
                        loading="lazy"
                    />
                ) : (
                    <div style={{
                        ...styles.productImage,
                        background: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af'
                    }}>
                        No Image
                    </div>
                )}
                {product.isPack && (
                    <span style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: '#8b5cf6',
                        color: 'white',
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                    }}>
                        แพ็ค
                    </span>
                )}
            </div>

            <div style={styles.productName} title={product.name}>
                {product.name}
            </div>
            <div style={{ marginTop: 'auto' }}>
                <div style={styles.productPrice}>
                    ฿{Number(product.price).toFixed(2)}
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison to ensure stability
    // product should be stable reference from filteredProducts (unless data changes)
    // isSelected boolean
    // isReorderMode boolean
    return (
        prevProps.product === nextProps.product &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isReorderMode === nextProps.isReorderMode &&
        prevProps.styles === nextProps.styles &&
        prevProps.className === nextProps.className
    );
});

export default ProductCard;
