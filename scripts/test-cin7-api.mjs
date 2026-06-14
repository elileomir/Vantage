#!/usr/bin/env node
// ============================================================
// CIN7 Core API — Connection & Data Test Script
// Tests all key endpoints before building Power BI queries
// ============================================================

const DEFAULT_BASE_URL = "https://inventory.dearsystems.com/ExternalApi/v2";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getConfig() {
  const baseUrl = (process.env.CIN7_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  return {
    baseUrl,
    accountId: getRequiredEnv("CIN7_ACCOUNT_ID"),
    apiKey: getRequiredEnv("CIN7_API_KEY"),
  };
}

let config;

function getActiveConfig() {
  if (!config) {
    config = getConfig();
  }
  return config;
}

// ── Helpers ──────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function log(color, label, msg) {
  console.log(`${color}${label}${COLORS.reset} ${msg}`);
}

function divider(title) {
  console.log(
    `\n${COLORS.cyan}${"═".repeat(60)}${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.cyan}  ${title}${COLORS.reset}`
  );
  console.log(
    `${COLORS.cyan}${"═".repeat(60)}${COLORS.reset}\n`
  );
}

// ── API Caller ───────────────────────────────────────────────

async function callAPI(endpoint, params = {}) {
  const activeConfig = getActiveConfig();
  const url = new URL(`${activeConfig.baseUrl}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const startTime = Date.now();

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "api-auth-accountid": activeConfig.accountId,
      "api-auth-applicationkey": activeConfig.apiKey,
      "Content-Type": "application/json",
    },
  });

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      elapsed,
    };
  }

  const data = await response.json();
  return { success: true, status: response.status, data, elapsed };
}

// ── Test Functions ───────────────────────────────────────────

async function testConnection() {
  divider("TEST 1: Connection Verification (/me)");

  const result = await callAPI("me");

  if (result.success) {
    log(COLORS.green, "  ✅ CONNECTED", `(${result.elapsed}ms)`);
    console.log(
      `${COLORS.dim}  Account Info:${COLORS.reset}`,
      JSON.stringify(result.data, null, 2)
    );
    return true;
  } else {
    log(
      COLORS.red,
      "  ❌ FAILED",
      `Status ${result.status}: ${result.statusText}`
    );
    console.log(`  Error: ${result.error}`);
    return false;
  }
}

async function testEndpoint(name, endpoint, dataKey, params = {}) {
  const result = await callAPI(endpoint, { Page: "1", Limit: "5", ...params });

  if (!result.success) {
    log(COLORS.red, `  ❌ ${name}`, `Status ${result.status}: ${result.error}`);
    return null;
  }

  const total = result.data.Total ?? "N/A";
  const records = result.data[dataKey] ?? [];
  const sampleFields = records.length > 0 ? Object.keys(records[0]) : [];

  log(
    COLORS.green,
    `  ✅ ${name}`,
    `${COLORS.bright}${total} total records${COLORS.reset} ${COLORS.dim}(${result.elapsed}ms)${COLORS.reset}`
  );
  log(
    COLORS.dim,
    `     Endpoint:`,
    `${getActiveConfig().baseUrl}/${endpoint}`
  );
  log(
    COLORS.dim,
    `     Data Key:`,
    `"${dataKey}"`
  );
  log(
    COLORS.dim,
    `     Fields (${sampleFields.length}):`,
    sampleFields.join(", ")
  );

  if (records.length > 0) {
    console.log(
      `${COLORS.dim}     Sample Record #1:${COLORS.reset}`
    );
    // Show a compact version of first record
    const sample = {};
    for (const [k, v] of Object.entries(records[0])) {
      if (v !== null && v !== "" && !Array.isArray(v) && typeof v !== "object") {
        sample[k] = v;
      }
    }
    const lines = JSON.stringify(sample, null, 2).split("\n");
    lines.forEach((line) => console.log(`       ${COLORS.dim}${line}${COLORS.reset}`));
  }

  console.log("");

  return { name, total, fields: sampleFields, sampleRecord: records[0] ?? null };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(
    `\n${COLORS.bright}${COLORS.magenta}╔══════════════════════════════════════════════════════════╗${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.magenta}║     CIN7 Core API — Pre-Power BI Validation Test        ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.magenta}╚══════════════════════════════════════════════════════════╝${COLORS.reset}\n`
  );

  config = getConfig();
  log(COLORS.green, "  ✅ Config", "Loaded CIN7 credentials from environment");
  log(COLORS.dim, "     Base URL:", config.baseUrl);

  // ── Step 1: Test connection ──
  const connected = await testConnection();
  if (!connected) {
    console.log(
      `\n${COLORS.red}  Connection failed. Check your Account ID and API Key.${COLORS.reset}\n`
    );
    process.exit(1);
  }

  // ── Step 2: Test all endpoints ──
  divider("TEST 2: Endpoint Discovery & Data Sampling");

  const endpoints = [
    ["Sale List", "saleList", "SaleList"],
    ["Purchase List", "purchaseList", "PurchaseList"],
    ["Products", "product", "Products"],
    ["Customers", "customer", "CustomerList"],
    ["Product Availability", "ref/productavailability", "ProductAvailabilityList"],
    ["Transactions", "transactions", "Transactions"],
    ["Categories", "ref/category", "CategoryList"],
    ["Brands", "ref/brand", "BrandList"],
    ["Locations", "ref/location", "LocationList"],
    ["Suppliers", "supplier", "SupplierList"],
    ["Tax Rules", "ref/taxrule", "TaxRuleList"],
    ["Payment Terms", "ref/paymentterm", "PaymentTermList"],
    ["Stock Adjustments", "stockadjustmentList", "StockAdjustmentList"],
    ["Bank Accounts", "ref/account/bank", "BankAccountsList"],
  ];

  const results = [];

  for (const [name, endpoint, dataKey] of endpoints) {
    try {
      const r = await testEndpoint(name, endpoint, dataKey);
      if (r) results.push(r);
    } catch (err) {
      log(COLORS.red, `  ❌ ${name}`, `Error: ${err.message}`);
    }

    // Small delay to respect rate limits (60 calls/min)
    await new Promise((r) => setTimeout(r, 300));
  }

  // ── Step 3: Summary ──
  divider("SUMMARY — Data Available for Power BI");

  console.log(
    `  ${COLORS.bright}Endpoint${" ".repeat(28)}Total Records    Fields${COLORS.reset}`
  );
  console.log(`  ${"─".repeat(56)}`);

  let totalRecords = 0;
  let totalPages = 0;

  for (const r of results) {
    const name = r.name.padEnd(35);
    const total = String(r.total).padStart(8);
    const fields = String(r.fields.length).padStart(6);
    const pages = r.total !== "N/A" ? Math.ceil(r.total / 500) : 0;
    totalRecords += r.total !== "N/A" ? r.total : 0;
    totalPages += pages;

    console.log(
      `  ${COLORS.cyan}${name}${COLORS.reset}${COLORS.bright}${total}${COLORS.reset}${COLORS.dim}${fields}${COLORS.reset}`
    );
  }

  console.log(`  ${"─".repeat(56)}`);
  console.log(
    `  ${COLORS.bright}Total Records: ${COLORS.green}${totalRecords.toLocaleString()}${COLORS.reset}`
  );
  console.log(
    `  ${COLORS.bright}Est. API Calls (at 500/page): ${COLORS.yellow}${totalPages}${COLORS.reset}`
  );
  console.log(
    `  ${COLORS.dim}  Rate limit: 60 calls/min → Est. refresh time: ~${Math.ceil(
      totalPages / 60
    )} min${COLORS.reset}`
  );

  // ── Step 4: Pagination Test ──
  divider("TEST 3: Pagination Verification (SaleList)");

  const page1 = await callAPI("saleList", { Page: "1", Limit: "2" });
  const page2 = await callAPI("saleList", { Page: "2", Limit: "2" });

  if (page1.success && page2.success) {
    const p1Records = page1.data.SaleList?.length ?? 0;
    const p2Records = page2.data.SaleList?.length ?? 0;

    log(COLORS.green, "  ✅ Page 1:", `${p1Records} records returned`);
    log(COLORS.green, "  ✅ Page 2:", `${p2Records} records returned`);

    if (p1Records > 0 && p2Records > 0) {
      const p1First = page1.data.SaleList[0].OrderNumber;
      const p2First = page2.data.SaleList[0].OrderNumber;
      log(
        COLORS.dim,
        "     Page 1 starts with:",
        p1First
      );
      log(
        COLORS.dim,
        "     Page 2 starts with:",
        p2First
      );

      if (p1First !== p2First) {
        log(COLORS.green, "  ✅ Pagination", "Working correctly — different records on each page");
      } else {
        log(COLORS.yellow, "  ⚠️  Pagination", "Same first record on both pages — check if there are enough records");
      }
    }
  } else {
    log(COLORS.red, "  ❌ Pagination", "Could not verify — API call failed");
  }

  // ── Done ──
  console.log(
    `\n${COLORS.bright}${COLORS.green}╔══════════════════════════════════════════════════════════╗${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.green}║     ✅ All tests complete — Ready for Power BI!         ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.green}╚══════════════════════════════════════════════════════════╝${COLORS.reset}\n`
  );
}

main().catch((err) => {
  console.error(`\n${COLORS.red}Fatal error: ${err.message}${COLORS.reset}`);
  if (err.message.includes("Missing required environment variable")) {
    console.error(
      `${COLORS.yellow}Create .env.local from .env.example or run with CIN7_ACCOUNT_ID and CIN7_API_KEY in the environment.${COLORS.reset}`
    );
  }
  process.exit(1);
});
