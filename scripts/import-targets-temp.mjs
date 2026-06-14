import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function excelDateToJSDate(serial) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

function getFiscalYear(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); 
  const fyYear = month >= 2 ? year + 1 : year;
  return `FY${fyYear}`;
}

async function importTargets() {
  console.log("Starting targets import...");

  console.log("Clearing existing targets...");
  const { error: deleteError } = await supabase.from("sales_targets").delete().neq("id", "00000000-0000-0000-0000-000000000000"); 
  if (deleteError) {
    console.error("Error clearing existing targets:", deleteError);
  }

  const files = [
    { name: "KRDM Sales Target 2025.xlsx", path: "reference/targets/KRDM Sales Target 2025.xlsx" },
    { name: "KRDM Sales Target 2026.xlsx", path: "reference/targets/KRDM Sales Target 2026.xlsx" }
  ];

  let totalInserted = 0;

  for (const file of files) {
    console.log(`Processing file: ${file.name}`);
    const wb = XLSX.readFile(file.path);
    const ws = wb.Sheets["Final "]; 
    
    if (!ws) {
      console.warn(`Sheet 'Final ' not found in ${file.name}. Skipping.`);
      continue;
    }

    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rawData.length < 2) continue;

    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    const monthCols = [];
    for (let i = 4; i < headers.length; i++) {
      if (typeof headers[i] === "number") {
        monthCols.push({ colIndex: i, date: excelDateToJSDate(headers[i]) });
      }
    }

    console.log(`Found ${monthCols.length} month columns in ${file.name}`);

    const recordsToInsert = [];

    for (const row of dataRows) {
      const salesRep = typeof row[0] === 'string' ? row[0].trim() : "Unknown";
      if (!salesRep || salesRep === "Unknown") continue;

      const customer = row[1] ? String(row[1]).trim() : "Unassigned";
      const brand = row[2] ? String(row[2]).trim() : "Unassigned";
      const yearlyForecast = row[3] ? Number(row[3]) : 0;

      for (const mc of monthCols) {
        const targetValue = row[mc.colIndex] ? Number(row[mc.colIndex]) : 0;
        
        const dateStr = mc.date.toISOString().split("T")[0];
        
        recordsToInsert.push({
          sales_rep: salesRep,
          customer: customer === "null" || customer === "" ? "Unassigned" : customer,
          brand: brand === "null" || brand === "" ? "Unassigned" : brand,
          fiscal_year: getFiscalYear(mc.date),
          month: mc.date.getMonth() + 1,
          month_date: dateStr,
          target_amount: targetValue,
          yearly_forecast: yearlyForecast
        });
      }
    }

    console.log(`Prepared ${recordsToInsert.length} records for ${file.name}. Inserting in batches...`);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from("sales_targets").insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
      } else {
        totalInserted += batch.length;
        process.stdout.write(`\rInserted ${totalInserted} records...`);
      }
    }
    console.log(`\nCompleted ${file.name}`);
  }

  console.log(`\nSuccessfully imported a total of ${totalInserted} target records.`);
}

importTargets().catch(console.error);
