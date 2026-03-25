-- ===========================================================
-- 🇸🇬 MINIMART — FULL SETUP สำหรับ Supabase Project ใหม่ (Singapore)
-- ===========================================================
-- วิธีใช้:
-- 1. สร้าง Supabase Project ใหม่ → เลือก Region: Singapore (ap-southeast-1)
-- 2. เข้า SQL Editor → New Query → Paste SQL นี้ทั้งหมด → Run ▶️
-- 3. จด URL + anon key ของ project ใหม่
-- 4. แก้ไฟล์ .env ให้ชี้ไป project ใหม่
-- 5. ไปหน้า Settings → Restore Backup จาก project เดิม
-- ===========================================================

-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    barcode TEXT DEFAULT '',
    price NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    "packSize" NUMERIC DEFAULT 1,
    "packPrice" NUMERIC DEFAULT 0,
    "packBarcode" TEXT DEFAULT '',
    "caseSize" NUMERIC DEFAULT 1,
    "casePrice" NUMERIC DEFAULT 0,
    "caseBarcode" TEXT DEFAULT '',
    "minStock" NUMERIC DEFAULT 0,
    zone TEXT DEFAULT '',
    "showInPOS" BOOLEAN DEFAULT false,
    "showInStore" BOOLEAN DEFAULT false,
    "isRecommended" BOOLEAN DEFAULT false,
    "isHero" BOOLEAN DEFAULT false,
    "posIndex" INTEGER DEFAULT 0,
    "soldToday" NUMERIC DEFAULT 0,
    "lastSoldAt" TIMESTAMPTZ,
    image TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    "totalDebt" NUMERIC DEFAULT 0,
    history JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== SHIFTS ====================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "startTime" TIMESTAMPTZ DEFAULT now(),
    "endTime" TIMESTAMPTZ,
    "startCash" NUMERIC DEFAULT 0,
    "actualCash" NUMERIC DEFAULT 0,
    sales NUMERIC DEFAULT 0,
    expenses NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'open',
    note TEXT DEFAULT '',
    transactions JSONB DEFAULT '[]'::jsonb,
    "productSales" JSONB DEFAULT '{}'::jsonb
);

-- ==================== ORDERS ====================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    "customerName" TEXT DEFAULT '',
    "customerPhone" TEXT DEFAULT '',
    "customerAddress" TEXT DEFAULT '',
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    "paymentMethod" TEXT DEFAULT 'cod',
    "paymentStatus" TEXT DEFAULT 'pending',
    "paymentProof" TEXT,
    note TEXT DEFAULT '',
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== SETTINGS ====================
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    name TEXT DEFAULT 'My Shop',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    "taxId" TEXT DEFAULT '',
    "promptPayId" TEXT DEFAULT '',
    "ttsVoice" TEXT
);

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    username TEXT DEFAULT '',
    name TEXT DEFAULT '',
    role TEXT DEFAULT 'cashier',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== EXPENSES ====================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT DEFAULT 'general',
    amount NUMERIC DEFAULT 0,
    period TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== WASTE LOGS ====================
CREATE TABLE IF NOT EXISTS waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID REFERENCES products(id),
    quantity NUMERIC DEFAULT 0,
    reason TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ==================== PRICE HISTORY ====================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID REFERENCES products(id),
    "oldPrice" NUMERIC DEFAULT 0,
    "newPrice" NUMERIC DEFAULT 0,
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);


-- ===========================================================
-- 🚀 PERFORMANCE INDEXES
-- ===========================================================

-- Products
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products ("updatedAt");
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_pack_barcode ON products ("packBarcode");
CREATE INDEX IF NOT EXISTS idx_products_case_barcode ON products ("caseBarcode");
CREATE INDEX IF NOT EXISTS idx_products_show_in_pos ON products ("showInPOS") WHERE "showInPOS" = true;
CREATE INDEX IF NOT EXISTS idx_products_show_in_store ON products ("showInStore") WHERE "showInStore" = true;
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_image_not_null ON products (id) WHERE image IS NOT NULL;

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts ("startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

-- Price History
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history ("productId");

-- Waste Logs
CREATE INDEX IF NOT EXISTS idx_waste_logs_product ON waste_logs ("productId");


-- ===========================================================
-- 🔓 ROW LEVEL SECURITY (RLS) — เปิดแบบ public access ผ่าน anon key
-- ===========================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated users
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON waste_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON price_history FOR ALL USING (true) WITH CHECK (true);


-- ===========================================================
-- 🔔 ENABLE REALTIME
-- ===========================================================

ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;


-- ===========================================================
-- ✅ SETUP COMPLETE! 
-- ตอนนี้:
-- 1. จด URL + anon key ของ project ใหม่นี้
-- 2. แก้ไฟล์ .env ในโปรเจค
-- 3. สร้าง user ใน Authentication → Users → Add User
-- 4. ไปหน้า Settings ในแอป → Restore Backup จาก project เดิม
-- ===========================================================
