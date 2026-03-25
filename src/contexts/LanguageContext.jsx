import React, { createContext, useContext, useState } from 'react';

const translations = {
    th: {
        // Common
        appName: 'Minimart POS',
        actions: 'จัดการ',
        cancel: 'ยกเลิก',
        save: 'บันทึก',
        confirm: 'ยืนยัน',
        delete: 'ลบ',
        edit: 'แก้ไข',
        search: 'ค้นหา',
        loading: 'กำลังโหลด...',
        success: 'สำเร็จ',
        error: 'เกิดข้อผิดพลาด',
        back: 'กลับ',

        // Navigation / Sidebar
        dashboard: 'ภาพรวม',
        sales: 'การขาย (POS)',
        inventory: 'สินค้า & สต็อก',
        products: 'สินค้า',

        customers: 'ลูกค้า',
        addCustomer: 'เพิ่มลูกค้า',
        editCustomer: 'แก้ไขลูกค้า',
        reports: 'รายงาน',
        settings: 'ตั้งค่า',
        logout: 'ออกจากระบบ',
        priceLabel: 'พิมพ์ป้ายราคา',

        orders: 'ออเดอร์',
        shiftHistory: 'ประวัติกะ',
        closeShift: 'ปิดกะ',

        // Tooltips & Status
        connected: 'เชื่อมต่อแล้ว',
        disconnected: 'ไม่ได้เชื่อมต่อ',

        openPOS: 'เปิดหน้าขาย',
        openCustomerDisplay: 'เปิดจอฝั่งลูกค้า',
        enableSound: 'เปิดเสียงแจ้งเตือน',
        disableSound: 'ปิดเสียงแจ้งเตือน',
        welcome: 'ยินดีต้อนรับ',

        // Inventory
        productName: 'ชื่อสินค้า',
        barcode: 'บาร์โค้ด',
        category: 'หมวดหมู่',
        price: 'ราคา',
        cost: 'ต้นทุน',
        stock: 'สต็อก',
        unit: 'หน่วย',
        zone: 'โซน',
        addProduct: 'เพิ่มสินค้า',
        editProduct: 'แก้ไขสินค้า',
        deleteConfirm: 'ยืนยันการลบสินค้า?',
        export: 'ส่งออก CSV',
        import: 'นำเข้า CSV',
        printLabels: 'พิมพ์ป้ายราคา',
        quickAdd: 'เพิ่มด่วน',
        noData: 'ไม่พบข้อมูล',
        searchProduct: 'ค้นหาสินค้า / บาร์โค้ด...',
        importSuccess: 'นำเข้าข้อมูลสำเร็จ {count} รายการ',
        importFailed: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล',

        // Inventory & Common
        scanBarcode: 'สแกนบาร์โค้ด',
        page: 'หน้า',
        of: 'จาก',
        showing: 'แสดง',
        to: 'ถึง',

        // POS & Orders
        saveOrder: 'บันทึกออเดอร์',
        reorderMode: 'จัดเรียงสินค้า',
        saveReorder: 'บันทึกลำดับ',
        cancelReorder: 'ยกเลิกการจัดเรียง',
        searchPlaceholder: 'ค้นหาสินค้า...',
        parkBill: 'พักบิล',
        viewParkedBills: 'ดูบิลที่พักไว้',
        clearCart: 'ล้างตะกร้า',
        checkout: 'ชำระเงิน',
        items: 'รายการ',
        discountLabel: 'ส่วนลด',
        receiveMoney: 'รับเงิน',
        changeMoney: 'เงินทอน',
        paymentMethod: 'วิธีการชำระเงิน',
        completePayment: 'ยืนยันการชำระเงิน',
        printReceipt: 'พิมพ์ใบเสร็จ',
        close: 'ปิด',
        cart: 'ตะกร้า',
        emptyCart: 'ตะกร้าว่าง',
        clickToAdd: 'คลิกสินค้าเพื่อเพิ่ม',
        confirmParkBill: 'ต้องการพักบิลปัจจุบันใช่หรือไม่?',
        confirmClearCart: 'ยืนยันการล้างตะกร้า?',
        startShift: 'เปิดกะการทำงาน (Open Shift)',
        shiftClosed: 'กรุณาเปิดกะก่อนเริ่มงาน',
        startCash: 'เงินทอนเริ่มต้น (บาท)',
        subtotal: 'ยอดรวมย่อย',
        discount: 'ส่วนลด',
        change: 'เงินทอน',
        payment: 'ชำระเงิน',
        cash: 'เงินสด',
        transfer: 'โอนเงิน',
        qrPayment: 'สแกน QR',
        receipt: 'ใบเสร็จ',
        newOrder: 'รายการใหม่',
        holdOrder: 'พักบิล',
        recallOrder: 'เรียกบิล',
        amount: 'จำนวนเงิน',
        quantity: 'จำนวน',
        addToCart: 'ใส่ตะกร้า',
        completeOrder: 'จบการขาย',

        // Dashboard
        todaySales: 'ยอดขายวันนี้',
        totalOrders: 'ออเดอร์ทั้งหมด',
        soldItems: 'จำนวนสินค้าที่ขาย',
        lowStock: 'สินค้าใกล้หมด',
        bestSellers: 'สินค้าขายดี',
        resetVisibilityDesc: 'ตั้งค่าสินค้าทุกชิ้นให้ "ไม่แสดง" ทั้งใน POS (เริ่มใหม่ทั้งหมด)',
        resetVisibilityBtn: 'ล้างค่าการแสดงผลเป็น "ซ่อนทั้งหมด"',
        defaultVoice: 'Default (ค่าเริ่มต้น)',
        voiceHint: '* รายชื่อเสียงอ้างอิงจากระบบปฏิบัติการ (Windows/Mac/Android) <br /> <strong>วิธีเพิ่มเสียง:</strong> ไปที่การตั้งค่าของ Windows (Settings) > Time & Language > Speech > Add voices',
        ttsNotSupported: 'Browser ไม่รองรับระบบเสียงพูด (TTS)',
        backingUp: 'กำลังสำรองข้อมูล...',
        backup: 'สำรองข้อมูล',
        restore: 'กู้คืนข้อมูล',
        clearDataFailed: 'ลบข้อมูลไม่สำเร็จ',
        resetSuccess: 'ล้างค่าเรียบร้อยแล้ว',
        resetFailed: 'ล้างค่าไม่สำเร็จ',
        recentOrders: 'ออเดอร์ล่าสุด',
        totalSales: 'ยอดขายรวม',
        totalDebt: 'ยอดค้างชำระ',
        profit: 'กำไร',
        revenueOverview: 'ภาพรวมรายได้',
        salesComparison: 'เปรียบเทียบยอดขาย',
        todayVsYesterday: 'วันนี้ vs เมื่อวาน',
        increaseFromYesterday: 'เพิ่มขึ้นจากเมื่อวาน',
        decreaseFromYesterday: 'ลดลงจากเมื่อวาน',
        today: 'วันนี้',
        yesterday: 'เมื่อวาน',
        difference: 'ผลต่าง',
        topProfit: 'สินค้ากำไรสูงสุด',
        profitPerItem: 'กำไรต่อชิ้น',
        lossProducts: 'สินค้ากำไรน้อย / ขาดทุน',
        pieces: 'ชิ้น',
        noSalesYet: 'ยังไม่มีการขาย',
        noDataSelected: 'ไม่มีข้อมูลในช่วงเวลาที่เลือก',
        exportSales: 'ส่งออกยอดขาย',
        exportProducts: 'ส่งออกสินค้า',
        week: 'สัปดาห์',
        month: 'เดือน',
        year: 'ปี',
        all: 'ทั้งหมด',

        // Settings
        generalSettings: 'ตั้งค่าทั่วไป',
        printerSettings: 'ตั้งค่าเครื่องพิมพ์',
        storeProfile: 'ข้อมูลร้านค้า',
        userManagement: 'จัดการผู้ใช้',
        language: 'ภาษา',

        // Messages
        deleteSuccess: 'ลบข้อมูลสำเร็จ',
        saveSuccess: 'บันทึกข้อมูลสำเร็จ',
        updateSuccess: 'อัพเดทข้อมูลสำเร็จ',
        networkError: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
    }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('th');

    const t = (key) => {
        return translations[language]?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ t, language, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
