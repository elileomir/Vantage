export interface KPIData {
  ytd_sales: number;
  ytd_target: number;
  ytd_achievement: number;
  yoy_growth: number;
  mtd_sales: number;
  customer_count: number;
}

export interface DailyDataPoint {
  date: string;
  daily_sales: number;
  daily_target: number;
  accum_sales: number;
  accum_target: number;
}

export interface BrandData {
  brand: string;
  amount: number;
}

export interface CustomerData {
  customer: string;
  total: number;
  amount: number;
  tax: number;
}

export interface CustomerRevenueRow {
  customer: string;
  sales_rep: string;
  top_brand: string;
  sales_amount: number;
  target_amount: number;
  prior_year_amount: number;
  order_count: number;
  brand_count: number;
  last_order_date: string;
}

export interface CustomerMonthRow {
  month: string;
  sales_amount: number;
  target_amount: number;
}

export interface CustomerBrandRow {
  brand: string;
  sales_amount: number;
  target_amount: number;
}

export interface CustomerAnalysisData {
  summary: {
    total_sales: number;
    total_target: number;
    active_customers: number;
    at_risk_customers: number;
  };
  customers: CustomerRevenueRow[];
  monthly: CustomerMonthRow[];
  brands: CustomerBrandRow[];
}

function makeDailyFixture(): DailyDataPoint[] {
  let accumSales = 0;
  let accumTarget = 0;

  return Array.from({ length: 22 }, (_, index) => {
    const day = index + 1;
    const dailySales = 38_000 + ((day * 7_250) % 31_000) + (day % 5) * 2_800;
    const dailyTarget = 45_000;

    accumSales += dailySales;
    accumTarget += dailyTarget;

    return {
      date: `Jun ${day}`,
      daily_sales: dailySales,
      daily_target: dailyTarget,
      accum_sales: accumSales,
      accum_target: accumTarget,
    };
  });
}

export const dashboardData = {
  kpis: {
    ytd_sales: 4_285_000,
    ytd_target: 5_100_000,
    ytd_achievement: 84,
    yoy_growth: 12.3,
    mtd_sales: 412_000,
    customer_count: 87,
  } satisfies KPIData,
  dailySales: makeDailyFixture(),
  brandRevenue: [
    { brand: "AMT", amount: 285_000 },
    { brand: "DREAMFARM", amount: 198_000 },
    { brand: "EPICUREAN", amount: 156_000 },
    { brand: "GOVINO", amount: 134_000 },
    { brand: "ZENKER", amount: 112_000 },
    { brand: "ANDRE VERDIER", amount: 98_000 },
    { brand: "GUEDE", amount: 76_000 },
    { brand: "Others", amount: 245_000 },
  ] satisfies BrandData[],
  topCustomers: [
    { customer: "Yuppiechef (Pty) Ltd", total: 245_320, amount: 213_322, tax: 31_998 },
    { customer: "@Home - Foschini Retail Group", total: 198_450, amount: 172_565, tax: 25_885 },
    { customer: "Kitchen Warehouse", total: 156_780, amount: 136_330, tax: 20_450 },
    { customer: "Tafelberg Bellville", total: 134_200, amount: 116_696, tax: 17_504 },
    { customer: "Cape Union Mart", total: 112_340, amount: 97_687, tax: 14_653 },
    { customer: "Mr Price Home", total: 98_760, amount: 85_878, tax: 12_882 },
    { customer: "Woolworths", total: 87_650, amount: 76_217, tax: 11_433 },
    { customer: "Pick n Pay", total: 76_540, amount: 66_557, tax: 9_983 },
  ] satisfies CustomerData[],
};

export const customerAnalysisData: CustomerAnalysisData = {
  summary: {
    total_sales: 4_285_000,
    total_target: 5_100_000,
    active_customers: 87,
    at_risk_customers: 14,
  },
  customers: [
    {
      customer: "Yuppiechef (Pty) Ltd",
      sales_rep: "Office",
      top_brand: "DREAMFARM",
      sales_amount: 612_480,
      target_amount: 690_000,
      prior_year_amount: 552_300,
      order_count: 42,
      brand_count: 18,
      last_order_date: "2026-06-05",
    },
    {
      customer: "@Home - Foschini Retail Group",
      sales_rep: "Debbie Gibson",
      top_brand: "LEIFHEIT",
      sales_amount: 548_920,
      target_amount: 520_000,
      prior_year_amount: 493_600,
      order_count: 35,
      brand_count: 15,
      last_order_date: "2026-06-04",
    },
    {
      customer: "(TA0001) Tafelberg Bellville",
      sales_rep: "Debbie Gibson",
      top_brand: "AMT",
      sales_amount: 428_150,
      target_amount: 485_000,
      prior_year_amount: 382_900,
      order_count: 28,
      brand_count: 22,
      last_order_date: "2026-06-03",
    },
    {
      customer: "Kitchen Warehouse",
      sales_rep: "Garden Route Rep",
      top_brand: "EPICUREAN",
      sales_amount: 366_770,
      target_amount: 410_000,
      prior_year_amount: 339_400,
      order_count: 31,
      brand_count: 12,
      last_order_date: "2026-06-02",
    },
    {
      customer: "Cape Union Mart",
      sales_rep: "Kerri Harvey",
      top_brand: "GOVINO",
      sales_amount: 305_640,
      target_amount: 295_000,
      prior_year_amount: 271_500,
      order_count: 24,
      brand_count: 9,
      last_order_date: "2026-06-01",
    },
    {
      customer: "Mr Price Home",
      sales_rep: "Online",
      top_brand: "ZENKER",
      sales_amount: 244_380,
      target_amount: 320_000,
      prior_year_amount: 251_200,
      order_count: 19,
      brand_count: 11,
      last_order_date: "2026-05-29",
    },
    {
      customer: "Woolworths",
      sales_rep: "Office",
      top_brand: "ANDRE VERDIER",
      sales_amount: 219_850,
      target_amount: 260_000,
      prior_year_amount: 206_300,
      order_count: 21,
      brand_count: 10,
      last_order_date: "2026-05-28",
    },
    {
      customer: "Pick n Pay",
      sales_rep: "Online",
      top_brand: "GUEDE",
      sales_amount: 188_420,
      target_amount: 205_000,
      prior_year_amount: 176_900,
      order_count: 17,
      brand_count: 8,
      last_order_date: "2026-05-27",
    },
  ],
  monthly: [
    { month: "Mar", sales_amount: 688_000, target_amount: 740_000 },
    { month: "Apr", sales_amount: 622_000, target_amount: 670_000 },
    { month: "May", sales_amount: 706_000, target_amount: 705_000 },
    { month: "Jun", sales_amount: 412_000, target_amount: 495_000 },
    { month: "Jul", sales_amount: 0, target_amount: 510_000 },
    { month: "Aug", sales_amount: 0, target_amount: 545_000 },
    { month: "Sep", sales_amount: 0, target_amount: 490_000 },
    { month: "Oct", sales_amount: 0, target_amount: 620_000 },
    { month: "Nov", sales_amount: 0, target_amount: 590_000 },
    { month: "Dec", sales_amount: 0, target_amount: 505_000 },
    { month: "Jan", sales_amount: 0, target_amount: 510_000 },
    { month: "Feb", sales_amount: 0, target_amount: 450_000 },
  ],
  brands: [
    { brand: "DREAMFARM", sales_amount: 524_000, target_amount: 590_000 },
    { brand: "LEIFHEIT", sales_amount: 496_000, target_amount: 470_000 },
    { brand: "AMT", sales_amount: 428_000, target_amount: 485_000 },
    { brand: "EPICUREAN", sales_amount: 366_000, target_amount: 410_000 },
    { brand: "GOVINO", sales_amount: 305_000, target_amount: 295_000 },
    { brand: "ZENKER", sales_amount: 244_000, target_amount: 320_000 },
  ],
};
