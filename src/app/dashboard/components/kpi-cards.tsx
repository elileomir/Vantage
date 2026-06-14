"use client";

import { TrendingUp, TrendingDown, Target, DollarSign, Users } from "lucide-react";
import CountUp from "@/components/ui/count-up";
import { StaggerChildren, StaggerItem } from "@/components/ui/fade-in";
import type { KPIData } from "@/lib/data/vantage";

const kpis = [
  { key: "ytd_sales" as const, label: "YTD Revenue", icon: DollarSign, prefix: "R ", suffix: "" },
  { key: "ytd_target" as const, label: "YTD Target", icon: Target, prefix: "R ", suffix: "" },
  { key: "ytd_achievement" as const, label: "Achievement", icon: TrendingUp, prefix: "", suffix: "%", isPercent: true },
  { key: "yoy_growth" as const, label: "YoY Growth", icon: TrendingUp, prefix: "", suffix: "%", showTrend: true },
  { key: "mtd_sales" as const, label: "MTD Revenue", icon: DollarSign, prefix: "R ", suffix: "" },
  { key: "customer_count" as const, label: "Active Customers", icon: Users, prefix: "", suffix: "" },
];

export function KPICards({ data }: { data: KPIData }) {
  return (
    <StaggerChildren className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const value = data[kpi.key] ?? 0;
        const isPositive = kpi.showTrend ? value >= 0 : true;

        return (
          <StaggerItem key={kpi.key}>
            <div className="metric-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {kpi.label}
                </span>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: "#a1145c1a" }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: "#a1145c" }} />
                </div>
              </div>

              <p className="text-xl font-semibold tracking-tight text-gray-900 tabular-nums">
                {kpi.prefix}
                <CountUp to={value} duration={1.5} separator="," />
                {kpi.suffix}
              </p>

              {kpi.showTrend && (
                <div className="mt-1.5 flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: "#16804b" }} />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" style={{ color: "#c4321c" }} />
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{ color: isPositive ? "#16804b" : "#c4321c" }}
                  >
                    {value >= 0 ? "+" : ""}{value.toFixed(1)}% vs last year
                  </span>
                </div>
              )}

              {kpi.isPercent && (
                <div className="mt-2.5 progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, value)}%`,
                      background:
                        value >= 100 ? "#16804b" : value >= 80 ? "#b45309" : "#c4321c",
                    }}
                  />
                </div>
              )}
            </div>
          </StaggerItem>
        );
      })}
    </StaggerChildren>
  );
}
