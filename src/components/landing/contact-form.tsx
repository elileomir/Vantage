"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2, AlertCircle } from "lucide-react";

type State = "idle" | "submitting" | "success" | "error";

const FIELD = "w-full rounded-[10px] border border-[#D7E6E9] bg-[#FCFEFE] px-3.5 py-2.5 text-[15px] text-[#0A2A31] outline-none transition placeholder:text-[#9fb6bc] hover:border-[#BcDce2] focus:border-[#18A8C4] focus:bg-white focus:ring-[3px] focus:ring-[#18A8C4]/15";
const LBL = "text-[13px] font-semibold text-[#3a5a62]";

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
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2"><span className={LBL}>Name <span className="text-[#18A8C4]">*</span></span><input name="name" required className={FIELD} placeholder="Mara Devlin" /></label>
        <label className="grid gap-2"><span className={LBL}>Work email <span className="text-[#18A8C4]">*</span></span><input name="email" type="email" required className={FIELD} placeholder="mara@marlowe.co" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2"><span className={LBL}>Company <span className="text-[#18A8C4]">*</span></span><input name="company" required className={FIELD} placeholder="Marlowe Trading" /></label>
        <label className="grid gap-2"><span className={LBL}>Role</span><input name="role" className={FIELD} placeholder="Head of Sales" /></label>
      </div>
      <label className="grid gap-2">
        <span className={LBL}>Team size</span>
        <select name="teamSize" className={`${FIELD} cursor-pointer`} defaultValue="">
          <option value="" disabled>Select…</option>
          <option>1–5</option><option>6–20</option><option>21–50</option><option>51–200</option><option>200+</option>
        </select>
      </label>
      <label className="grid gap-2"><span className={LBL}>What would you like to see?</span><textarea name="message" rows={4} className={`${FIELD} resize-none`} placeholder="Tell us about your data and how your team reports today…" /></label>

      {state === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-[#c4321c]"><AlertCircle className="h-4 w-4" /> Something went wrong. Please try again or email us directly.</p>
      )}

      <button type="submit" disabled={state === "submitting"} className="mt-1 flex h-12 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60" style={{ background: "#0E6478", boxShadow: "0 10px 24px -12px rgba(14,100,120,0.7)" }}>
        {state === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Request a demo"}
      </button>
      <p className="text-center text-xs text-[#7e98a0]">No spam. We&apos;ll only use your details to get back to you.</p>
    </form>
  );
}
