# Supabase Migration Plan & SQL Schema

This document contains the SQL commands needed to set up your Supabase database. Run these in the **Supabase SQL Editor** to create the necessary tables and security policies.

## 🚀 Step 1: Execute SQL Schema

```sql
-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Products Table
CREATE TABLE products (
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

-- 2. Orders Table
CREATE TABLE orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  createdAt timestamp with time zone DEFAULT now(),
  updatedAt timestamp with time zone DEFAULT now()
);

-- 3. Customers Table
CREATE TABLE customers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  phone text UNIQUE,
  address text,
  totalDebt decimal DEFAULT 0,
  lastPurchased timestamp with time zone,
  createdAt timestamp with time zone DEFAULT now()
);

-- 4. Shifts Table
CREATE TABLE shifts (
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
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text,
  name text,
  role text DEFAULT 'cashier',
  createdAt timestamp with time zone DEFAULT now()
);

-- Real-time Subscriptions (Enable for tables)
ALTER PUBLICATION supabase_realtime ADD TABLE products, orders, customers, shifts;

-- Security (RLS) - Basic Public Access (Recommended to refine for production)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All" ON products FOR ALL USING (true);
CREATE POLICY "Allow All" ON orders FOR ALL USING (true);
CREATE POLICY "Allow All" ON customers FOR ALL USING (true);
CREATE POLICY "Allow All" ON shifts FOR ALL USING (true);
CREATE POLICY "Allow All" ON profiles FOR ALL USING (true);
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
