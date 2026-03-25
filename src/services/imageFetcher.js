// Multi-source product image fetcher
// Tries multiple APIs in sequence until an image is found

// Source 1: Open Food Facts (best for food/beverages)
const fetchFromOpenFoodFacts = async (barcode) => {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.status === 1 && data.product) {
            return data.product.image_url || data.product.image_front_url || null;
        }
        return null;
    } catch {
        console.log("OpenFoodFacts: Not found");
        return null;
    }
};

// Source 2: Open Beauty Facts (for cosmetics/personal care)
const fetchFromOpenBeautyFacts = async (barcode) => {
    try {
        const response = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.status === 1 && data.product) {
            return data.product.image_url || data.product.image_front_url || null;
        }
        return null;
    } catch {
        console.log("OpenBeautyFacts: Not found");
        return null;
    }
};

// Source 3: Open Pet Food Facts (for pet products)
const fetchFromOpenPetFoodFacts = async (barcode) => {
    try {
        const response = await fetch(`https://world.openpetfoodfacts.org/api/v0/product/${barcode}.json`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.status === 1 && data.product) {
            return data.product.image_url || data.product.image_front_url || null;
        }
        return null;
    } catch {
        console.log("OpenPetFoodFacts: Not found");
        return null;
    }
};

// Source 4: UPCitemdb (free tier - limited requests)
const fetchFromUPCitemdb = async (barcode) => {
    try {
        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.items && data.items.length > 0 && data.items[0].images && data.items[0].images.length > 0) {
            return data.items[0].images[0];
        }
        return null;
    } catch {
        console.log("UPCitemdb: Not found or rate limited");
        return null;
    }
};

// Main function: Try all sources in sequence
export const fetchProductImage = async (barcode) => {
    if (!barcode || String(barcode).length < 8) return null;

    const cleanBarcode = String(barcode).trim();

    // Try sources in order of reliability
    const sources = [
        { name: 'OpenFoodFacts', fn: fetchFromOpenFoodFacts },
        { name: 'OpenBeautyFacts', fn: fetchFromOpenBeautyFacts },
        { name: 'OpenPetFoodFacts', fn: fetchFromOpenPetFoodFacts },
        { name: 'UPCitemdb', fn: fetchFromUPCitemdb }
    ];

    for (const source of sources) {
        try {
            const imageUrl = await source.fn(cleanBarcode);
            if (imageUrl) {
                console.log(`Found image from ${source.name} for ${cleanBarcode}`);
                return imageUrl;
            }
        } catch {
            // Continue to next source
        }
    }

    return null;
};
