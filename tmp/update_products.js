import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 1. Mark as Best Seller (isRecommended)
    const { data: p1 } = await supabase.from('products').select('*').ilike('name', '%น้ำแพ็คเล็ก%');
    const { data: p2 } = await supabase.from('products').select('*').ilike('name', '%น้ำแพ็คใหญ่%');

    const ids = [...(p1||[]), ...(p2||[])].map(p => p.id);
    
    if (ids.length > 0) {
        // Need to check if is_recommended exists, I'll just use RPC or update
        // Update posIndex to very low numbers to pin them at the top
        for (const p of (p1||[])) {
            await supabase.from('products').update({ posIndex: -100, isRecommended: true }).eq('id', p.id);
            console.log(`Updated ${p.name} to posIndex -100 (Pinned Top)`);
        }
        for (const p of (p2||[])) {
            await supabase.from('products').update({ posIndex: -99, isRecommended: true }).eq('id', p.id);
            console.log(`Updated ${p.name} to posIndex -99 (Pinned Top)`);
        }
    } else {
        console.log('Target products not found');
    }
}

run();
