"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, AlertCircle } from "lucide-react";

type State = "idle" | "submitting" | "success" | "error";

const FIELD = "w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-[#0A2A31] outline-none transition placeholder:text-[#9fb6bc] focus:border-[#18A8C4] focus:ring-2 focus:ring-[#18A8C4]/20";

export function ContactForm() {
  const [state, setState] = useState<State>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "submitting") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      role: String(fd.get("role") ?? "").trim(),
      teamSize: String(fd.get("teamSize") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
      source: "vantage-landing",
      submittedAt: new Date().toISOString(),
    };
    setState("submitting");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("bad status");
      setState("success");
      form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center rounded-2xl border border-[#DBE9EC] bg-[#F4FBFC] px-6 py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "#0E6478" }}>
          <Check className="h-6 w-6 text-white" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-[#0A2A31]">Thanks — we&apos;ll be in touch.</h3>
        <p className="mt-1.5 max-w-sm text-sm text-[#51707A]">Your message is on its way to our team. Expect a reply within one business day.</p>
        <button onClick={() => setState("idle")} className="mt-5 text-sm font-semibold text-[#0E6478] hover:underline">Send another message</button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="grid gap-1.5"><span className="text-sm font-medium text-[#51707A]">Name *</span><input name="name" required className={FIELD} placeholder="Jane Cooper" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-medium text-[#51707A]">Work email *</span><input name="email" type="email" required className={FIELD} placeholder="jane@company.com" /></label>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="grid gap-1.5"><span className="text-sm font-medium text-[#51707A]">Company *</span><input name="company" required className={FIELD} placeholder="Company name" /></label>
        <label className="grid gap-1.5"><span className="text-sm font-medium text-[#51707A]">Role</span><input name="role" className={FIELD} placeholder="Head of Sales" /></label>
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-[#51707A]">Team size</span>
        <select name="teamSize" className={FIELD} defaultValue="">
          <option value="" disabled>Select…</option>
          <option>1–5</option><option>6–20</option><option>21–50</option><option>51–200</option><option>200+</option>
        </select>
      </label>
      <label className="grid gap-1.5"><span className="text-sm font-medium text-[#51707A]">What would you like to see?</span><textarea name="message" rows={4} className={FIELD} placeholder="Tell us about your data and reporting today…" /></label>

      {state === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-[#c4321c]"><AlertCircle className="h-4 w-4" /> Something went wrong. Please try again or email us directly.</p>
      )}

      <button type="submit" disabled={state === "submitting"} className="v-btn v-btn-primary mt-1 justify-center disabled:opacity-60">
        {state === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Request a demo"}
      </button>
      <p className="text-center text-xs text-[#7e98a0]">No spam. We&apos;ll only use your details to get back to you.</p>
    </form>
  );
}
