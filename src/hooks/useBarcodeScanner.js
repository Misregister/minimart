import { useEffect, useRef } from 'react';


export const useBarcodeScanner = (onScan, options = {}) => {
    const {
        minLength = 3,
        threshold = 40, // Strict 40ms limit for scanner detection
        preventObj = window
    } = options;

    const buffer = useRef('');
    const lastKeyTime = useRef(0);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime.current;

            // Reset buffer if typing is too slow (manual entry)
            if (timeDiff > threshold) {
                buffer.current = '';
            }
            lastKeyTime.current = now;

            if (e.key === 'Enter') {
                const rawBuffer = buffer.current;
                // Sanitize: Keep only numbers (fixes mixed input issues)
                const barcode = rawBuffer.replace(/[^0-9]/g, "");

                if (barcode.length >= minLength) {
                    onScan(barcode);
                }

                buffer.current = '';
                // Optional: Prevent default if needed, but usually redundant here
                return;
            }

            // Layout-Independent Number Mapping
            // Uses e.code (Physical Key) instead of e.key (Character)
            // This ensures 'Digit1' always becomes '1', even if Thai layout outputs 'ๅ'
            if (e.code.startsWith('Digit')) {
                buffer.current += e.code.slice(5); // "Digit1" -> "1"
            } else if (e.code.startsWith('Numpad')) {
                buffer.current += e.code.slice(6); // "Numpad1" -> "1"
            } else if (e.key.length === 1) {
                // Fallback for other characters (though we prioritize numbers)
                buffer.current += e.key;
            }
        };

        preventObj.addEventListener('keydown', handleKeyDown);

        return () => {
            preventObj.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan, minLength, threshold, preventObj]);
};
