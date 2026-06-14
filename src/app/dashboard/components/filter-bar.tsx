"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

interface FilterOption {
  label: string;
  key: string;
  options: string[];
}

const filterDefinitions: FilterOption[] = [
  {
    label: "Fiscal Year",
    key: "fiscal_year",
    options: ["FY2026", "FY2025", "FY2024"],
  },
  {
    label: "Quarter",
    key: "quarter",
    options: ["Q1", "Q2", "Q3", "Q4"],
  },
  {
    label: "Month",
    key: "month",
    options: [
      "March", "April", "May", "June", "July", "August",
      "September", "October", "November", "December", "January", "February",
    ],
  },
  {
    label: "Sales Rep",
    key: "sales_rep",
    options: [],
  },
  {
    label: "Brand",
    key: "brand",
    options: [],
  },
  {
    label: "Customer",
    key: "customer",
    options: [],
  },
];

export function FilterBar() {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    fiscal_year: "FY2026",
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  function setFilter(key: string, value: string) {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setOpenDropdown(null);
  }

  function clearFilter(key: string) {
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const activeCount = Object.keys(activeFilters).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filterDefinitions.map((filter) => {
        const isActive = filter.key in activeFilters;
        const activeValue = activeFilters[filter.key];

        return (
          <div key={filter.key} className="relative">
            <button
              onClick={() =>
                setOpenDropdown(openDropdown === filter.key ? null : filter.key)
              }
              data-active={isActive}
              className="filter-chip"
            >
              <span>
                {isActive ? `${filter.label}: ${activeValue}` : filter.label}
              </span>
              {isActive ? (
                <X
                  className="h-3 w-3 text-[--color-accent] hover:text-[--color-accent-hover]"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFilter(filter.key);
                  }}
                />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {openDropdown === filter.key && filter.options.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpenDropdown(null)}
                />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-[220px] min-w-[160px] overflow-y-auto rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-raised] py-1 shadow-lg">
                  {filter.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFilter(filter.key, opt)}
                      className={`w-full px-3 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-[--color-bg-inset] ${
                        activeValue === opt
                          ? "font-medium text-[--color-accent]"
                          : "text-[--color-fg-muted]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      {activeCount > 0 && (
        <button
          onClick={() => setActiveFilters({})}
          className="text-[0.6875rem] text-[--color-fg-faint] transition-colors hover:text-[--color-fg-muted]"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
