// =====================================================
// 🚀 Migrate ALL data: Old Supabase (Mumbai) → New Supabase (Singapore)
// Run: node migrate_data.mjs
// =====================================================

import { createClient } from '@supabase/supabase-js';

// OLD project (Mumbai ap-south-1)
const OLD_URL = 'https://yljpladucyvqefwnpssl.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsanBsYWR1Y3l2cWVmd25wc3NsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0NzcwMywiZXhwIjoyMDkwMDIzNzAzfQ.P_uNA16KO4erxm741L3mSSQoc-1sGc75QohPJDy2McE';

// NEW project (Singapore ap-southeast-1)
const NEW_URL = 'https://igwwmzgszgzlaawcbyxk.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd3dtemdzemd6bGFhd2NieXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MzQ5NywiZXhwIjoyMDkwMDM5NDk3fQ.0r_FWYSr3wyZ2MHvCTcJQ0fRHJXqKMP34wiLPh0IfN0';

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

// Tables to migrate (order matters for foreign keys)
const TABLES = ['settings', 'products', 'customers', 'shifts', 'orders', 'expenses', 'waste_logs', 'price_history'];

async function fetchAll(client, table) {
    let all = [];
    let from = 0;
    const step = 500;
    while (true) {
        const { data, error } = await client
            .from(table)
            .select('*')
            .range(from, from + step - 1);
        
        if (error) {
            console.error(`  ❌ Error reading ${table}:`, error.message);
            break;
        }
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < step) break;
        from += step;
    }
    return all;
}

async function migrateTable(table) {
    console.log(`\n📦 Migrating: ${table}...`);
    
    // 1. Read from old
    const data = await fetchAll(oldDb, table);
    if (data.length === 0) {
        console.log(`  ⏭️  No data in ${table}, skipping.`);
        return 0;
    }
    console.log(`  📥 Read ${data.length} rows from old DB`);

    // 2. Write to new (in chunks to avoid timeout)
    const CHUNK = 200;
    let inserted = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
        const chunk = data.slice(i, i + CHUNK);
        const { error } = await newDb
            .from(table)
            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
        
        if (error) {
            console.error(`  ❌ Error writing ${table} chunk ${i}:`, error.message);
            // Try one by one for failed chunk
            for (const row of chunk) {
                const { error: singleErr } = await newDb.from(table).upsert(row, { onConflict: 'id' });
                if (singleErr) {
                    console.error(`  ⚠️  Skip row ${row.id}: ${singleErr.message}`);
                } else {
                    inserted++;
                }
            }
        } else {
            inserted += chunk.length;
        }
    }
    console.log(`  ✅ Migrated ${inserted}/${data.length} rows to Singapore`);
    return inserted;
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 MIGRATION: Mumbai (old) → Singapore (new)');
    console.log('='.repeat(60));

    const startTime = Date.now();
    let totalRows = 0;

    for (const table of TABLES) {
        totalRows += await migrateTable(table);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log(`✅ MIGRATION COMPLETE!`);
    console.log(`   Total: ${totalRows} rows migrated in ${elapsed}s`);
    console.log('='.repeat(60));
}

main().catch(console.error);
