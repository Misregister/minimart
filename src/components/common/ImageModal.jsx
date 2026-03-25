import React, { useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';

const ImageModal = ({ isOpen, onClose, imageUrl, altText }) => {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleEsc);
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !imageUrl) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
            }}
            onClick={onClose}
        >
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                <X size={24} />
            </button>

            <div
                style={{
                    position: 'relative',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}
                onClick={e => e.stopPropagation()} // Prevent close when clicking image
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    <ZoomIn size={18} />
                    <span>รูปภาพสินค้าสำหรับจัดเตรียม</span>
                </div>
                <img
                    src={imageUrl}
                    alt={altText || "Product enlarge"}
                    style={{
                        maxWidth: '100%',
                        maxHeight: 'calc(90vh - 40px)',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        backgroundColor: '#fff' // In case image has transparent background
                    }}
                />
            </div>
        </div>
    );
};

export default ImageModal;
