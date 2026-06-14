export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { getFiscalStartMonth } from "@/lib/data/queries";
import { FiscalYearForm } from "./fiscal-year-form";
import { SyncTierForm } from "./sync-tier-form";
import { ExclusionsForm, type Exclusion } from "./exclusions-form";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function fiscalRange(start: number): string {
  return `${MONTH_NAMES[start - 1]} to ${MONTH_NAMES[(start + 10) % 12]}`;
}

const TIER_LABEL: Record<string, string> = { manual: "Manual", standard: "Standard", pro: "Pro", enterprise: "Enterprise" };
const TIER_CADENCE: Record<string, string> = { manual: "No automatic sync", standard: "Daily", pro: "Hourly", enterprise: "Every 15 minutes" };

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

interface Org {
  id: string;
  name: string;
  sync_tier: string;
  sync_frequency_minutes: number;
  cin7_last_sync_at: string | null;
  cin7_last_sync_status: string | null;
  cin7_last_sync_rows: number | null;
}

interface Profile {
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
}

function initials(profile: Profile | null, fallbackEmail: string | null): string {
  const source = profile?.full_name?.trim() || profile?.email || fallbackEmail || "";
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[0.8125rem] text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function SyncStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const fiscalStart = await getFiscalStartMonth();
  const { data: exclusionRows } = await supabase.from("sales_exclusions").select("value, label").order("label");
  const exclusions = (exclusionRows ?? []) as Exclusion[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let org: Org | null = null;
  let orgRole = "Member";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("email, full_name, role, avatar_url")
      .eq("id", user.id)
      .single();
    profile = (data as Profile | null) ?? null;

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role, organizations(id, name, sync_tier, sync_frequency_minutes, cin7_last_sync_at, cin7_last_sync_status, cin7_last_sync_rows)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) {
      orgRole = (membership.role as string) ?? "Member";
      org = (membership.organizations as unknown as Org) ?? null;
    }
  }

  const displayName = profile?.full_name?.trim() || "Not set";
  const displayEmail = profile?.email || user?.email || "Not available";
  const role = orgRole || profile?.role || "Member";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Account and workspace" />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
            Profile
          </h3>
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold"
              style={{ background: "#fbe8f1", color: "#a1145c" }}
            >
              {initials(profile, user?.email ?? null)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {displayName}
              </p>
              <p className="truncate text-[0.8125rem] text-gray-400">
                {displayEmail}
              </p>
            </div>
          </div>

          <dl className="mt-4 divide-y" style={{ borderColor: "#edebe7" }}>
            <Row label="Full name" value={displayName} />
            <Row label="Email" value={displayEmail} />
            <Row
              label="Role"
              value={<span className="badge badge-accent">{role}</span>}
            />
          </dl>
        </section>

        <section className="surface p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
            Workspace
          </h3>
          <dl className="divide-y" style={{ borderColor: "#edebe7" }}>
            <Row label="Organization" value={org?.name ?? "—"} />
            <Row
              label="Data source"
              value={
                <span className="inline-flex items-center gap-1.5">
                  CIN7 Core
                  <span className="badge badge-positive">Live</span>
                </span>
              }
            />
            <Row label="Database" value="Supabase" />
            <Row label="Currency" value="ZAR" />
            <Row label="Fiscal year" value={fiscalRange(fiscalStart)} />
          </dl>
        </section>

        {/* Data Sync status + tier control */}
        <section className="surface p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">Data Sync</h3>
            <span className="badge badge-accent">{TIER_LABEL[org?.sync_tier ?? "manual"] ?? "Manual"} · {TIER_CADENCE[org?.sync_tier ?? "manual"]}</span>
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
            <SyncStat label="Last sync" value={relativeTime(org?.cin7_last_sync_at ?? null)} />
            <SyncStat
              label="Status"
              value={
                <span className={`badge ${org?.cin7_last_sync_status === "succeeded" ? "badge-positive" : org?.cin7_last_sync_status ? "badge-warning" : "badge-info"}`}>
                  {org?.cin7_last_sync_status ?? "pending"}
                </span>
              }
            />
            <SyncStat label="Rows last run" value={String(org?.cin7_last_sync_rows ?? 0)} />
          </div>
          <div className="mt-5 border-t pt-5" style={{ borderColor: "#edebe7" }}>
            {orgRole === "owner" || orgRole === "admin" ? (
              <SyncTierForm current={org?.sync_tier ?? "manual"} />
            ) : (
              <p className="text-[0.8125rem] text-gray-400">Only an organization owner or admin can change the sync tier.</p>
            )}
          </div>
        </section>

        <section className="surface p-5 lg:col-span-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
            Fiscal Year
          </h3>
          <p className="mb-4 text-[0.8125rem] text-gray-400">
            KRDM&apos;s fiscal year runs March to February. Change the start month if your
            reporting year differs.
          </p>
          <FiscalYearForm current={fiscalStart} />
        </section>

        {/* Sales exclusions */}
        <section className="surface p-5 lg:col-span-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
            Sales Exclusions
          </h3>
          <p className="mb-4 text-[0.8125rem] text-gray-400">
            Non-sales buckets (Finance, Delivery Fees, Display &amp; Signage, Marketing and Advertising)
            are excluded from every Sales total. Add or remove brands/categories below.
          </p>
          <ExclusionsForm exclusions={exclusions} />
        </section>
      </div>
    </div>
  );
}
