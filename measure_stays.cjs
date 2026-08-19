const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:\\Users\\lmfau\\OneDrive\\Escritorio\\Code\\ZZZ\\AI Studio Admin\\.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    let allStays = [];
    let page = 0;
    while(true) {
        const { data: dbStays, error: dbErr } = await supabase
            .from('stays')
            .select('id, entry_time')
            .gte('entry_time', '2026-05-01T00:00:00Z')
            .order('entry_time', { ascending: false })
            .range(page * 1000, (page + 1) * 1000 - 1);
            
        if (dbErr) {
            console.error("DB Error:", dbErr);
            break;
        }
        if (!dbStays || dbStays.length === 0) break;
        allStays = allStays.concat(dbStays);
        page++;
    }
    
    console.log(`Total Stays in DB since 2026-05-01: ${allStays.length}`);
    if (allStays.length > 0) {
        console.log(`Min entry_time: ${allStays[allStays.length-1].entry_time}`);
        console.log(`Max entry_time: ${allStays[0].entry_time}`);
    }
}
run();
