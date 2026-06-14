#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const targetsDir = path.join(repoRoot, "reference", "targets");

const DEFAULT_FILES = [
  "KRDM Sales Target 2025.xlsx",
  "KRDM Sales Target 2026.xlsx",
];

function parseArgs(argv) {
  const args = {
    dryRun: true,
    files: [],
    sample: 5,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--write") {
      args.dryRun = false;
    } else if (arg === "--file") {
      const next = argv[i + 1];
      if (!next) throw new Error("--file requires a workbook file name");
      args.files.push(next);
      i += 1;
    } else if (arg === "--sample") {
      const next = Number(argv[i + 1]);
      if (!Number.isInteger(next) || next < 0) {
        throw new Error("--sample requires a non-negative integer");
      }
      args.sample = next;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.files.length === 0) {
    args.files = DEFAULT_FILES;
  }

  return args;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const text = typeof value === "string" ? value.trim() : value;
  if (text === "-") return 0;

  const number = Number(String(text).replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    throw new Error(`Expected numeric target value, received ${JSON.stringify(value)}`);
  }
  return Number(number.toFixed(2));
}

function excelSerialToIsoDate(serial) {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) {
    throw new Error(`Could not parse Excel date serial: ${serial}`);
  }
  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
}

function parseHeaderDate(cell) {
  if (!cell) return null;

  if (cell.t === "n") {
    return excelSerialToIsoDate(cell.v);
  }

  if (cell.v instanceof Date) {
    const year = cell.v.getUTCFullYear();
    const month = String(cell.v.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cell.v.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = cleanText(cell.w ?? cell.v);
  if (!text) return null;

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Could not parse month header: ${text}`);
  }

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fiscalYearFor(monthDate) {
  const year = Number(monthDate.slice(0, 4));
  const month = Number(monthDate.slice(5, 7));
  const fiscalYearStart = month >= 3 ? year : year - 1;
  return {
    fiscalYear: `FY${fiscalYearStart}`,
    fiscalYearStart,
  };
}

function getMonthColumns(sheet, headerRowIndex) {
  const monthColumns = [];

  for (let columnIndex = 4; columnIndex < 64; columnIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
    const monthDate = parseHeaderDate(sheet[address]);

    if (!monthDate) continue;

    const { fiscalYear, fiscalYearStart } = fiscalYearFor(monthDate);
    monthColumns.push({
      columnIndex,
      fiscalMonth: monthColumns.length + 1,
      fiscalYear,
      fiscalYearStart,
      monthDate,
    });
  }

  if (monthColumns.length !== 12) {
    throw new Error(`Expected 12 month columns, found ${monthColumns.length}`);
  }

  return monthColumns;
}

function parseWorkbook(fileName) {
  const workbookPath = path.join(targetsDir, fileName);
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Workbook has no sheets: ${fileName}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  const header = rows[0] ?? [];
  const requiredHeaders = ["Sales Rep", "Customer", "Brand", "Yearly Forecast Sale"];
  for (const [index, expected] of requiredHeaders.entries()) {
    if (cleanText(header[index]) !== expected) {
      throw new Error(
        `${fileName}: expected header ${expected} at column ${index + 1}, received ${JSON.stringify(header[index])}`
      );
    }
  }

  const monthColumns = getMonthColumns(sheet, 0);
  const normalizedRows = [];
  const sourceRows = rows.slice(1);

  sourceRows.forEach((row, sourceRowOffset) => {
    const salesRep = cleanText(row[0]);
    if (!salesRep) return;

    const customer = cleanText(row[1]);
    const brand = cleanText(row[2]);
    const yearlyForecast = toNumber(row[3]);
    const sourceRow = sourceRowOffset + 2;

    for (const monthColumn of monthColumns) {
      normalizedRows.push({
        fiscal_year: monthColumn.fiscalYear,
        fiscal_year_start: monthColumn.fiscalYearStart,
        month: monthColumn.fiscalMonth,
        month_date: monthColumn.monthDate,
        sales_rep: salesRep,
        customer,
        brand,
        target_amount: toNumber(row[monthColumn.columnIndex]),
        yearly_forecast: yearlyForecast,
        source_file: fileName,
        source_sheet: sheetName.trim(),
        source_row: sourceRow,
      });
    }
  });

  const totalTarget = normalizedRows.reduce((sum, row) => sum + row.target_amount, 0);
  const uniqueSalesReps = new Set(normalizedRows.map((row) => row.sales_rep));
  const uniqueCustomers = new Set(normalizedRows.map((row) => row.customer).filter(Boolean));
  const uniqueBrands = new Set(normalizedRows.map((row) => row.brand).filter(Boolean));

  return {
    fileName,
    sheetName,
    sourceRowCount: sourceRows.length,
    normalizedRowCount: normalizedRows.length,
    nonZeroTargetRows: normalizedRows.filter((row) => row.target_amount !== 0).length,
    totalTarget: Number(totalTarget.toFixed(2)),
    uniqueSalesReps: uniqueSalesReps.size,
    uniqueCustomers: uniqueCustomers.size,
    uniqueBrands: uniqueBrands.size,
    monthColumns,
    normalizedRows,
  };
}

function printSummary(results, sampleSize) {
  console.log("Vantage target workbook dry run");
  console.log(`Source directory: ${targetsDir}`);
  console.log("");

  let allRows = 0;
  let allNonZeroRows = 0;
  let allTotalTarget = 0;

  for (const result of results) {
    allRows += result.normalizedRowCount;
    allNonZeroRows += result.nonZeroTargetRows;
    allTotalTarget += result.totalTarget;

    console.log(`File: ${result.fileName}`);
    console.log(`  Sheet: ${JSON.stringify(result.sheetName)}`);
    console.log(`  Source rows: ${result.sourceRowCount}`);
    console.log(`  Normalized rows: ${result.normalizedRowCount}`);
    console.log(`  Non-zero target rows: ${result.nonZeroTargetRows}`);
    console.log(`  Total target: ${result.totalTarget.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}`);
    console.log(`  Sales reps: ${result.uniqueSalesReps}`);
    console.log(`  Customers: ${result.uniqueCustomers}`);
    console.log(`  Brands: ${result.uniqueBrands}`);
    console.log(
      `  Months: ${result.monthColumns[0].monthDate} to ${result.monthColumns.at(-1).monthDate}`
    );

    if (sampleSize > 0) {
      console.log("  Sample normalized rows:");
      for (const row of result.normalizedRows.slice(0, sampleSize)) {
        console.log(`    ${JSON.stringify(row)}`);
      }
    }

    console.log("");
  }

  console.log("Combined:");
  console.log(`  Normalized rows: ${allRows}`);
  console.log(`  Non-zero target rows: ${allNonZeroRows}`);
  console.log(`  Total target: ${allTotalTarget.toLocaleString("en-ZA", { style: "currency", currency: "ZAR" })}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun) {
    throw new Error(
      "Database writes are disabled. Confirm the KRDM Supabase project and implement an explicit importer before using --write."
    );
  }

  const results = args.files.map(parseWorkbook);
  printSummary(results, args.sample);
}

try {
  main();
} catch (error) {
  console.error(`Target inspection failed: ${error.message}`);
  process.exit(1);
}
