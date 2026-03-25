// 🚫 Hide ALL products from POS
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igwwmzgszgzlaawcbyxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd3dtemdzemd6bGFhd2NieXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MzQ5NywiZXhwIjoyMDkwMDM5NDk3fQ.0r_FWYSr3wyZ2MHvCTcJQ0fRHJXqKMP34wiLPh0IfN0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('📦 Updating 2326 products: setting showInPOS = false...');
    
    const { error } = await supabase
        .from('products')
        .update({ showInPOS: false })
        .neq('id', '00000000-0000-0000-0000-000000000001'); // Match all
    
    if (error) {
        console.error('❌ Failed:', error.message);
    } else {
        console.log('✅ Success! All products hidden from POS.');
        console.log('Now you can manually choose which ones to show in Inventory.');
    }
    process.exit(0);
}

main();
