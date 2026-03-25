// 🔥→🐘 Firebase → Supabase Singapore (v3: 100% migration)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const firebaseApp = initializeApp({
    apiKey: "AIzaSyDPljCfrRuOOFVlNX1fqL41dyENeFnLsZc",
    authDomain: "minimart-db029.firebaseapp.com",
    projectId: "minimart-db029",
    storageBucket: "minimart-db029.firebasestorage.app",
    messagingSenderId: "295346591558",
    appId: "1:295346591558:web:a62d1b2db69978e5803747",
});
const db = getFirestore(firebaseApp);
const sb = createClient(
    'https://igwwmzgszgzlaawcbyxk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnd3dtemdzemd6bGFhd2NieXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2MzQ5NywiZXhwIjoyMDkwMDM5NDk3fQ.0r_FWYSr3wyZ2MHvCTcJQ0fRHJXqKMP34wiLPh0IfN0'
);

const isUUID = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Force serialize Firestore docs to plain JSON (kills all class instances)
function forceSerialize(doc) {
    try {
        return JSON.parse(JSON.stringify(doc, (key, val) => {
            // Handle Firestore Timestamp with toDate()
            if (val && typeof val === 'object' && typeof val.toDate === 'function') {
                return val.toDate().toISOString();
            }
            return val;
        }));
    } catch {
        return doc;
    }
}

// Convert any {seconds, nanoseconds} objects to ISO string (after JSON serialization)
function deepFixTimestamps(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
        // v3-json: Catch stringified timestamp objects like '{"type":"firestore/timestamp/1.0","seconds":123,...}'
        if (val.includes('"seconds"') && val.includes('"nanoseconds"')) {
            try {
                const parsed = JSON.parse(val);
                if (parsed.seconds !== undefined) {
                    return new Date(parsed.seconds * 1000).toISOString();
                }
            } catch {}
        }
        // v4-raw: Catch raw string format "Timestamp(seconds=1769408564, nanoseconds=10000000)"
        const match = val.match(/Timestamp\(seconds=(\d+)/i);
        if (match && match[1]) {
            return new Date(parseInt(match[1]) * 1000).toISOString();
        }
        return val;
    }
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(deepFixTimestamps);
    // Detect timestamp objects — ANY object with 'seconds' property
    if (val.seconds !== undefined && val.nanoseconds !== undefined) {
        return new Date(val.seconds * 1000).toISOString();
    }
    const out = {};
    for (const [k, v] of Object.entries(val)) {
        out[k] = deepFixTimestamps(v);
    }
    return out;
}

const COLS = {
    products: ['id','name','barcode','price','cost','stock','category','unit','packSize','packPrice','packBarcode','caseSize','casePrice','caseBarcode','minStock','zone','showInPOS','showInStore','isRecommended','isHero','posIndex','soldToday','lastSoldAt','image','updatedAt','createdAt'],
    customers: ['id','name','phone','address','totalDebt','history','createdAt'],
    shifts: ['id','startTime','endTime','startCash','actualCash','sales','expenses','status','note','transactions','productSales'],
    orders: ['id','customerName','customerPhone','customerAddress','items','total','status','paymentMethod','paymentStatus','paymentProof','note','createdAt','updatedAt'],
    settings: ['id','name','address','phone','taxId','promptPayId','ttsVoice'],
};

const UUID_TABLES = new Set(['products','customers','shifts']);
const NUM = new Set(['price','cost','stock','packSize','packPrice','caseSize','casePrice','minStock','posIndex','soldToday','total','totalDebt','startCash','actualCash','sales','expenses','amount']);
const BOOL = new Set(['showInPOS','showInStore','isRecommended','isHero']);

function cleanDoc(raw, table) {
    const allowed = COLS[table];
    if (!allowed) return null;

    // Step 1: Force to plain JSON (removes Firestore class instances)
    const serialized = forceSerialize(raw);
    // Step 2: Fix any remaining {seconds, nanoseconds} objects
    const doc = deepFixTimestamps(serialized);

    const out = {};
    for (const key of allowed) {
        if (key === 'id') {
            out.id = (UUID_TABLES.has(table) && !isUUID(doc.id)) ? randomUUID() : doc.id;
            continue;
        }
        if (doc[key] === undefined || doc[key] === null) continue;

        let v = doc[key];
        if (NUM.has(key)) v = Number(v) || 0;
        if (BOOL.has(key)) v = Boolean(v);
        // Ensure string timestamps are valid
        if (['createdAt','updatedAt','startTime','endTime','lastSoldAt'].includes(key)) {
            if (typeof v === 'number') v = new Date(v).toISOString();
            if (typeof v === 'string' && !v.includes('T') && !v.includes('-')) {
                v = new Date(Number(v) || Date.now()).toISOString();
            }
        }
        out[key] = v;
    }

    // Ensure required field
    if (!out.name && table === 'products') out.name = 'Unknown';
    if (!out.createdAt && allowed.includes('createdAt')) out.createdAt = new Date().toISOString();

    return out;
}

async function migrate(colName, table) {
    table = table || colName;
    process.stdout.write(`\n📦 ${colName}...`);

    const snap = await getDocs(collection(db, colName));
    const docs = [];
    snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
    if (!docs.length) { console.log(' ⏭️ empty'); return 0; }
    console.log(` 🔥 ${docs.length} docs`);

    const cleaned = docs.map(d => cleanDoc(d, table)).filter(Boolean);

    let ok = 0, fail = 0;
    const errors = [];
    const CHUNK = 50;
    for (let i = 0; i < cleaned.length; i += CHUNK) {
        const chunk = cleaned.slice(i, i + CHUNK);
        const { error } = await sb.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
            for (const row of chunk) {
                const { error: e } = await sb.from(table).upsert(row, { onConflict: 'id' });
                if (!e) ok++;
                else {
                    fail++;
                    if (errors.length < 5) errors.push({ id: row.id, name: row.name, err: e.message });
                }
            }
        } else {
            ok += chunk.length;
        }
        process.stdout.write(`\r  ⬆️ ${Math.min(i+CHUNK, cleaned.length)}/${cleaned.length} (✅${ok} ❌${fail})`);
    }
    console.log(`\n  ✅ ${ok}/${docs.length} migrated`);
    if (errors.length > 0) {
        console.log('  Sample errors:');
        errors.forEach(e => console.log(`    ${e.name || e.id}: ${e.err}`));
    }
    return ok;
}

async function main() {
    console.log('==================================================');
    console.log('🔥→🐘 Firebase → Supabase Singapore (v3)');
    console.log('==================================================');
    const t = Date.now();
    let total = 0;
    for (const c of ['products','customers','shifts','orders','settings']) {
        total += await migrate(c);
    }
    console.log('\n==================================================');
    console.log(`✅ DONE! ${total} rows in ${((Date.now()-t)/1000).toFixed(1)}s`);
    console.log('==================================================');
    process.exit(0);
}

main().catch(e => { console.error('💥', e); process.exit(1); });
