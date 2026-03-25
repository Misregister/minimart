-- =====================================================
-- 🚀 PERFORMANCE INDEXES สำหรับ Minimart POS
-- เพิ่มใน: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- 1. Index สำหรับ ORDER BY name (ใช้ทุกครั้งที่โหลดสินค้า)
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);

-- 2. Index สำหรับ Delta Sync (updatedAt)
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products ("updatedAt");

-- 3. Index สำหรับ หา barcode (POS scan)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_pack_barcode ON products ("packBarcode");
CREATE INDEX IF NOT EXISTS idx_products_case_barcode ON products ("caseBarcode");

-- 4. Index สำหรับ filter showInPOS / showInStore
CREATE INDEX IF NOT EXISTS idx_products_show_in_pos ON products ("showInPOS") WHERE "showInPOS" = true;
CREATE INDEX IF NOT EXISTS idx_products_show_in_store ON products ("showInStore") WHERE "showInStore" = true;

-- 5. Index สำหรับ category filter
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

-- 6. Composite index สำหรับ image fetch (id + image NOT NULL)
CREATE INDEX IF NOT EXISTS idx_products_image_not_null ON products (id) WHERE image IS NOT NULL;

-- 7. Orders table
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- 8. Shifts table
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts ("startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status);

-- 9. Customers table
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

-- ✅ เสร็จแล้ว! น่าจะเร็วขึ้น 2-5x ทันที
