export const MOCK_PRODUCTS = [
    {
        id: '1',
        barcode: '8850002011111',
        name: 'Mineral Water 500ml',
        price: 10,
        cost: 5,
        stock: 24, // Total pieces
        category: 'เครื่องดื่ม',
        image: null,
        unit: 'Bottle',
        packSize: 12, // 1 Pack = 12 Bottles
        packPrice: 100, // Price for one pack
        minStock: 10,
        zone: 'Fridge 1'
    },
    {
        id: '2',
        barcode: '8850002022222',
        name: 'Cola 325ml',
        price: 15,
        cost: 8,
        stock: 48,
        category: 'Beverage',
        image: null,
        unit: 'Can',
        packSize: 24,
        packPrice: 350,
        minStock: 20,
        zone: 'Fridge 1'
    },
    {
        id: '3',
        barcode: '8850002033333',
        name: 'Potato Chips 50g',
        price: 20,
        cost: 12,
        stock: 15,
        category: 'ขนมและลูกอม',
        image: null,
        unit: 'Bag',
        packSize: 6,
        packPrice: 110,
        minStock: 12,
        zone: 'Shelf A'
    },
    {
        id: '4',
        barcode: '8850002044444',
        name: 'Instant Noodles Tom Yum',
        price: 8,
        cost: 4.5,
        stock: 100,
        category: 'อาหารแห้ง',
        image: null,
        unit: 'Pack',
        packSize: 30, // 1 Box = 30 Packs
        packPrice: 120,
        minStock: 30,
        zone: 'Shelf B'
    },
    {
        id: '5',
        barcode: '8850002055555',
        name: 'Green Tea 500ml',
        price: 25,
        cost: 15,
        stock: 8,
        category: 'Beverage',
        image: null,
        unit: 'Bottle',
        packSize: 24,
        packPrice: 550,
        minStock: 12,
        zone: 'Fridge 2'
    }
];

export const CATEGORY_LIST = [
    { id: 'แอลกอฮอร์และบุหรี่', label: 'แอลกอฮอร์และบุหรี่', icon: '🍺' },
    { id: 'ขนมและลูกอม', label: 'ขนมและลูกอม', icon: '🍬' },
    { id: 'เครื่องดื่ม', label: 'เครื่องดื่ม', icon: '🥤' },
    { id: 'นมและโยเกิร์ต', label: 'นมและโยเกิร์ต', icon: '🥛' },
    { id: 'สุขภาพและความงาม', label: 'สุขภาพและความงาม', icon: '💄' },
    { id: 'ของใช้ในครัวเรือน', label: 'ของใช้ในครัวเรือน', icon: '🏠' },
    { id: 'ครัวและเครื่องปรุงรส', label: 'ครัวและเครื่องปรุงรส', icon: '🍳' },
    { id: 'อาหารแห้ง', label: 'อาหารแห้ง', icon: '🍜' },
    { id: 'ของเล่นและเครื่องเขียน', label: 'ของเล่นและเครื่องเขียน', icon: '🧸' },
    { id: 'สัตว์เลี้ยง', label: 'สัตว์เลี้ยง', icon: '🐶' },
    { id: 'ยาสามัญประจำบ้าน', label: 'ยาสามัญประจำบ้าน', icon: '💊' },
    { id: 'ไอศกรีม', label: 'ไอศกรีม', icon: '🍦' },
    { id: 'อื่นๆ', label: 'อื่นๆ', icon: '📦' }
];
