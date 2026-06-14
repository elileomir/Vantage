"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Persist the fiscal-year start month and recompute the calendar (via RPC). */
export async function setFiscalYearStart(
  month: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "Pick a month between January and December." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_fiscal_year_start", { p_month: month });
  if (error) return { ok: false, error: error.message };
  // Recomputed calendar affects every dashboard; refresh the whole dashboard tree.
  revalidatePath("/krdm", "layout");
  return { ok: true };
}

// Auto-sync cadence per tier (minutes). 'manual' = no automatic sync.
const TIER_FREQUENCY: Record<string, number> = {
  manual: 525600, // effectively never (the cron skips tier='manual' anyway)
  standard: 1440, // daily
  pro: 60, // hourly
  enterprise: 15, // every 15 minutes
};

/** Change the organization's auto-sync tier (and matching cadence). Owner/admin only via RLS. */
export async function setSyncTier(tier: string): Promise<{ ok: boolean; error?: string }> {
  if (!(tier in TIER_FREQUENCY)) return { ok: false, error: "Unknown sync tier." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return { ok: false, error: "No organization found for this account." };
  const { error } = await supabase
    .from("organizations")
    .update({ sync_tier: tier, sync_frequency_minutes: TIER_FREQUENCY[tier], updated_at: new Date().toISOString() })
    .eq("id", member.org_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/krdm/settings");
  return { ok: true };
}

/** Add a brand/category to the Sales exclusion list (matched case-insensitively). */
export async function addExclusion(value: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const v = value.trim().toUpperCase();
  if (!v) return { ok: false, error: "Enter a brand or category to exclude." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_exclusions")
    .upsert({ value: v, label: label.trim() || value.trim() }, { onConflict: "value" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/krdm", "layout"); // affects every Sales total
  return { ok: true };
}

export async function removeExclusion(value: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("sales_exclusions").delete().eq("value", value);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/krdm", "layout");
  return { ok: true };
}
