
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envFile = readFileSync(".env", "utf8");
const env = Object.fromEntries(envFile.split("\n").filter(line => line && !line.startsWith("#")).map(line => line.split("=").map(s => s.trim().replace(/^"|"$/g, ""))));
const supabase = createClient(env["VITE_SUPABASE_URL"] || env["NEXT_PUBLIC_SUPABASE_URL"], env["VITE_SUPABASE_ANON_KEY"] || env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

async function run() {
    const { data: dbStays, error } = await supabase
        .from("stays")
        .select("id, entry_time")
        .gte("entry_time", "2026-07-01T00:00:00Z")
        .order("entry_time", { ascending: false })
        .limit(50000);
        
    console.log("Returned rows with limit(50000): " + dbStays.length);
}
run();

