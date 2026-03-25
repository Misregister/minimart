// 🗑️ Clear ALL data from Supabase Singapore
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igwwmzgszgzlaawcbyxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd3dtemdzemd6bGFhd2NieXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MzQ5NywiZXhwIjoyMDkwMDM5NDk3fQ.0r_FWYSr3wyZ2MHvCTcJQ0fRHJXqKMP34wiLPh0IfN0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = ['price_history', 'waste_logs', 'expenses', 'orders', 'shifts', 'customers', 'products', 'settings'];

async function clearTable(table) {
    console.log(`🗑️ Clearing ${table}...`);
    // Universal filter: where ID is not null (replaces all)
    const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000001'); // Valid UUID and also works for TEXT
    
    if (error) {
        console.error(`  ❌ Error: ${error.message}`);
    } else {
        console.log(`  ✅ Success`);
    }
}

async function main() {
    console.log('='.repeat(50));
    console.log('🚀 CLEARING ALL SUPABASE DATA (Singapore)');
    console.log('='.repeat(50));
    
    for (const table of TABLES) {
        await clearTable(table);
    }
    
    console.log('\n✅ ALL TABLES CLEARED');
    process.exit(0);
}

main().catch(console.error);
