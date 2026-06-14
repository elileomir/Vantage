"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FilterBar } from "@/components/filter-bar";
import { RefreshButton } from "@/components/refresh-button";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  UserCheck,
  Table2,
  CalendarDays,
  Target,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  BarChart3,
} from "lucide-react";

const navSections = [
  {
    label: "Analytics",
    items: [
      // Order mirrors the Power BI report pages.
      { label: "Executive Summary", href: "/dashboard", icon: LayoutDashboard },
      { label: "Brand & Product", href: "/dashboard/brands", icon: ShoppingBag },
      { label: "Sales Representative", href: "/dashboard/reps", icon: UserCheck },
      { label: "Customer Analysis", href: "/dashboard/customers", icon: Users },
      { label: "Tabular Summary", href: "/dashboard/tabular", icon: Table2 },
      { label: "Daily", href: "/dashboard/daily", icon: CalendarDays },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Targets", href: "/dashboard/targets", icon: Target },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  const sidebarWidth = collapsed ? "w-[60px]" : "w-[248px]";

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: "#faf9f7" }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/8 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-[width] duration-200 lg:static ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{
          background: "#faf9f7",
          borderColor: "#e5e3de",
        }}
      >
        {/* Header */}
        <div
          className="flex h-14 shrink-0 items-center justify-between px-3"
          style={{ borderBottom: "1px solid #edebe7" }}
        >
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: "#a1145c" }}
              >
                <BarChart3 className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-gray-900">
                Vantage
              </span>
            </Link>
          )}
          {collapsed && (
            <div
              className="mx-auto flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: "#a1145c" }}
            >
              <BarChart3 className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={`h-4 w-4 transition-transform duration-200 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-gray-400 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5">
              {!collapsed && (
                <p className="mb-2 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={qs ? `${item.href}?${qs}` : item.href}
                        onClick={() => setMobileOpen(false)}
                        data-active={active}
                        className="nav-item"
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 ${
                            active ? "text-[#a1145c]" : "text-gray-400"
                          }`}
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2" style={{ borderTop: "1px solid #edebe7" }}>
          <button
            onClick={handleSignOut}
            className="nav-item w-full text-gray-400 hover:text-red-600"
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex h-14 shrink-0 items-center justify-between px-4 lg:px-6"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #e5e3de",
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "#16804b1a" }}>
              <span className="live-dot" />
              <span className="text-xs font-medium" style={{ color: "#16804b" }}>
                Live
              </span>
            </div>
            <RefreshButton />
          </div>
        </header>

        {/* Global filters */}
        <div
          className="shrink-0 px-4 py-2.5 lg:px-6"
          style={{ background: "#ffffff", borderBottom: "1px solid #e5e3de" }}
        >
          <FilterBar />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
