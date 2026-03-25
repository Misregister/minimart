# Supabase Migration Plan & SQL Schema

This document contains the SQL commands needed to set up your Supabase database. Run these in the **Supabase SQL Editor** to create the necessary tables and security policies.

### 📊 ขั้นตอนที่ 4: ระบบวิเคราะห์เจาะลึก (Advanced Analytics & Inventory Insights)
**กรุณารัน SQL นี้ใน Supabase SQL Editor เพื่อรองรับระบบพยากรณ์และบริหารจัดการต้นทุน:**

```sql
-- 1. เพิ่มคอลัมน์เก็บประวัติการขายล่าสุด (เพื่อเช็ค Dead Stock)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastSoldAt" timestamptz;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "soldToday" double precision DEFAULT 0;

-- 2. ตารางบันทึกค่าใช้จ่าย (ค่าไฟ, ค่าน้ำ, ค่าจ้าง, ค่าเช่า)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'electricity', 'utility', 'salary', 'rent', 'other'
  amount double precision DEFAULT 0,
  period date NOT NULL, -- วัน/เดือน/ปี ที่ระบุรอบภาษี/ค่าใช้จ่าย
  notes text,
  createdAt timestamptz DEFAULT now()
);

-- 3. ตารางบันทึกสินค้าคัดทิ้ง (Loss & Wastage)
CREATE TABLE IF NOT EXISTS waste_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  productId text REFERENCES products(id),
  quantity double precision NOT NULL,
  reason text, -- 'expired', 'damaged', 'lost'
  cost_at_time double precision, -- เก็บต้นทุน ณ วันนั้น
  createdAt timestamptz DEFAULT now()
);

-- 4. บันทึกประวัติราคาสินค้า (เพื่อตรวจวัด Price Elasticity)
CREATE TABLE IF NOT EXISTS price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  productId text REFERENCES products(id),
  oldPrice double precision,
  newPrice double precision,
  updatedAt timestamptz DEFAULT now()
);

-- 5. เพิ่ม RLS Policies เพื่อให้แอปอ่าน/เขียนข้อมูลได้
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All" ON expenses;
CREATE POLICY "Allow All" ON expenses FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON waste_logs;
CREATE POLICY "Allow All" ON waste_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow All" ON price_history;
CREATE POLICY "Allow All" ON price_history FOR ALL USING (true);

-- 6. เพิ่ม Index เพื่อความรวดเร็วในการค้นหา
CREATE INDEX IF NOT EXISTS products_lastsold_idx ON products (lastSoldAt);
CREATE INDEX IF NOT EXISTS waste_product_idx ON waste_logs (productId);
CREATE INDEX IF NOT EXISTS price_history_product_idx ON price_history (productId);
```

## 🚀 Step 1: Execute SQL Schema

```sql
-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  barcode text UNIQUE,
  name text NOT NULL,
  category text,
  price decimal DEFAULT 0,
  fullPrice decimal DEFAULT 0,
  cost decimal DEFAULT 0,
  stock decimal DEFAULT 0,
  soldToday decimal DEFAULT 0,
  unit text,
  packSize int DEFAULT 1,
  packBarcode text,
  packPrice decimal DEFAULT 0,
  packCost decimal DEFAULT 0,
  caseSize int DEFAULT 1,
  caseBarcode text,
  casePrice decimal DEFAULT 0,
  caseCost decimal DEFAULT 0,
  image text,
  showInPOS boolean DEFAULT false,
  showInStore boolean DEFAULT false,
  isRecommended boolean DEFAULT false,
  posIndex int DEFAULT 0,
  createdAt timestamp with time zone DEFAULT now(),
  updatedAt timestamp with time zone DEFAULT now()
);

-- 2. Orders Table (Using Text ID for custom IDs like W-YYMMDD-XXXX)
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  customerName text NOT NULL,
  customerPhone text,
  shippingAddress text,
  addressMemo text,
  location jsonb,
  items jsonb NOT NULL,
  total decimal NOT NULL,
  paymentMethod text,
  slipUrl text,
  deliveryTime text,
  status text DEFAULT 'pending',
  paymentStatus text DEFAULT 'pending',
  createdAt timestamp with time zone DEFAULT now(),
  updatedAt timestamp with time zone DEFAULT now()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  phone text UNIQUE,
  address text,
  totalDebt decimal DEFAULT 0,
  history jsonb DEFAULT '[]',
  lastPurchased timestamp with time zone,
  createdAt timestamp with time zone DEFAULT now()
);

-- 4. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  startTime timestamp with time zone DEFAULT now(),
  endTime timestamp with time zone,
  status text DEFAULT 'open',
  startCash decimal DEFAULT 0,
  sales decimal DEFAULT 0,
  netCash decimal DEFAULT 0,
  expenses decimal DEFAULT 0,
  withdrawals decimal DEFAULT 0,
  transactions jsonb DEFAULT '[]',
  productSales jsonb DEFAULT '{}',
  note text,
  actualCash decimal DEFAULT 0,
  createdAt timestamp with time zone DEFAULT now()
);

-- 5. Users Table (Profile)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text,
  name text,
  role text DEFAULT 'cashier',
  createdAt timestamp with time zone DEFAULT now()
);

-- 6. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  name text,
  address text,
  phone text,
  taxId text,
  promptPayId text,
  ttsVoice text,
  updatedAt timestamp with time zone DEFAULT now()
);

-- Real-time Subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE products, orders, customers, shifts;

-- Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Basic Public Access Policies (Recommended to refine for production)
CREATE POLICY "Allow All" ON products FOR ALL USING (true);
CREATE POLICY "Allow All" ON orders FOR ALL USING (true);
CREATE POLICY "Allow All" ON customers FOR ALL USING (true);
CREATE POLICY "Allow All" ON shifts FOR ALL USING (true);
CREATE POLICY "Allow All" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow All" ON settings FOR ALL USING (true);
```

## 📦 Step 2: Storage Buckets

In the Supabase Dashboard under **Storage**, create the following public buckets:
1.  `slips` (For payment slip uploads)
2.  `products` (For product image uploads)

## 🔑 Step 3: Environment Variables

Update your `.env` or Vercel Environment Variables:
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
