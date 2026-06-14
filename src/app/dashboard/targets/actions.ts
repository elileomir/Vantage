"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/**
 * Update one monthly target cell for a (rep, customer, brand) line.
 * Writes go through the user's Supabase session, so RLS enforces the admin/manager role.
 */
export async function updateTargetCell(input: {
  fy: string;
  rep: string;
  customer: string;
  brand: string;
  month: number;
  amount: number;
}): Promise<SaveResult> {
  const { fy, rep, customer, brand, month, amount } = input;
  if (!fy || !rep || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "Invalid target reference." };
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    return { ok: false, error: "Amount must be between 0 and 1,000,000,000." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_targets")
    .update({ target_amount: Math.round(amount), updated_at: new Date().toISOString() })
    .eq("fiscal_year", fy)
    .eq("sales_rep", rep)
    .eq("customer", customer)
    .eq("brand", brand)
    .eq("month", month)
    .select("id");

  if (error) {
    if (/permission|rls|policy/i.test(error.message)) {
      return { ok: false, error: "You do not have permission to edit targets (admin or manager only)." };
    }
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "No matching target row, or your role cannot edit targets." };
  }

  revalidatePath("/dashboard/targets");
  return { ok: true };
}
