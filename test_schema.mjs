
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const envFile = readFileSync(".env", "utf8");
const env = Object.fromEntries(envFile.split("\n").filter(line => line && !line.startsWith("#")).map(line => line.split("=").map(s => s.trim().replace(/^"|"$/g, ""))));
const supabase = createClient(env["VITE_SUPABASE_URL"] || env["NEXT_PUBLIC_SUPABASE_URL"], env["VITE_SUPABASE_ANON_KEY"] || env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

async function run() {
    const { data, error } = await supabase.rpc("get_table_schema", { table_name: "partial_closes" });
    if(error) {
        // Fallback: fetch one row and list keys
        const {data: row} = await supabase.from("partial_closes").select("*").limit(1);
        if (row && row.length > 0) console.log(Object.keys(row[0]));
    } else console.log(data);
}
run();

