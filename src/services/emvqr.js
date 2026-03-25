
// Pure JS CRC16 CCITT (0xFFFF) Implementation compatible with EMVCo
// Removing dependency on 'crc' or 'buffer' to prevent Vite build errors
const calculateCRC = (text) => {
    // 1. Encode to UTF-8 bytes (required for special chars)
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
        crc &= 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
};

export const updateQrAmount = (payload, amount) => {
    if (!payload) return '';

    // 1. Remove existing CRC (Tag 63 at the end)
    let raw = payload;
    const crcIndex = raw.lastIndexOf('6304');
    if (crcIndex !== -1 && crcIndex === raw.length - 8) {
        raw = raw.substring(0, raw.length - 8);
    }

    // 2. Parse TLV to find where to insert Amount (Tag 54)
    let index = 0;
    let parts = [];
    while (index < raw.length) {
        const id = raw.substr(index, 2);
        const lenStr = raw.substr(index + 2, 2);
        const len = parseInt(lenStr, 10);

        if (isNaN(len)) break; // Error or end

        const value = raw.substr(index + 4, len);

        // Filter out existing CRC (63) and Amount (54) to avoid duplicates
        if (id !== '63' && id !== '54') {
            parts.push({ id, len, value });
        }

        index += 4 + len;
    }

    // 3. Construct new payload
    const amountStr = Number(amount).toFixed(2);
    const amountLen = amountStr.length.toString().padStart(2, '0');
    const amountTag = `54${amountLen}${amountStr}`;

    let newPayload = '';
    let addedAmount = false;

    for (const part of parts) {
        // Insert Amount (54) before Country (58) or any tag > 54
        if (!addedAmount && parseInt(part.id) > 54) {
            newPayload += amountTag;
            addedAmount = true;
        }

        newPayload += `${part.id}${part.len.toString().padStart(2, '0')}${part.value}`;

        // Fallback for ordering if needed
        if (!addedAmount && part.id === '53') {
            newPayload += amountTag;
            addedAmount = true;
        }
    }

    if (!addedAmount) {
        newPayload += amountTag;
    }

    // 4. Add CRC
    newPayload += '6304';
    const crc = calculateCRC(newPayload);
    newPayload += crc;

    return newPayload;
};
