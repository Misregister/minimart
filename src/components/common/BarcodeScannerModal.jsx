import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import Modal from './Modal';
import { X } from './Icons';

const BarcodeScannerModal = ({ isOpen, onClose, onScan }) => {
    const scannerRef = useRef(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let html5QrCode;
        const config = {
            fps: 15, // Increased FPS for smoother scanning
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                // Expanded scanning area for 1D barcodes (wider rectangle)
                return { width: viewfinderWidth * 0.9, height: viewfinderHeight * 0.4 };
            },
            aspectRatio: 1.0,
            useBarCodeDetectorIfSupported: true, // Use native API if available
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ]
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            html5QrCode = new Html5Qrcode("reader");

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    // Success
                    // Play a beep if possible or vibration
                    if (navigator.vibrate) navigator.vibrate(200);
                    onScan(decodedText);
                    onClose();
                },
                (errorMessage) => {
                    // Parse error, ignore usually
                }
            ).catch(err => {
                console.error("Error starting scanner", err);
                setError('Could not start camera. Please ensure permissions are granted.');
            });

            scannerRef.current = html5QrCode;
        }, 300);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current.clear();
                }).catch(err => {
                    console.error("Failed to stop scanner", err);
                });
            }
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode" size="md">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {error ? (
                    <div className="text-danger mb-4">{error}</div>
                ) : (
                    <div id="reader" style={{ width: '100%', maxWidth: '400px', minHeight: '300px', background: '#000' }}></div>
                )}
                <p className="text-muted mt-4 text-sm">
                    Point camera at a barcode to search
                </p>
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;
