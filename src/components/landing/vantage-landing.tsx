"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Database, Sparkles, Send, Smartphone, Target, ShieldCheck,
  ArrowRight, Check, MessageCircle, Mail, Monitor,
} from "lucide-react";
import { VantageLogo } from "./vantage-logo";
import { HeroVisual } from "./hero-visual";
import { ContactForm } from "./contact-form";

const INK = "#0A2A31";
const SLATE = "#51707A";
const BRAND = "#0E6478";

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const FEATURES = [
  { icon: Database, title: "Dashboards from messy data", body: "Connect CIN7, spreadsheets and more. Vantage models the mess into clean, governed metrics your team can trust." },
  { icon: Sparkles, title: "Ask in plain language", body: "Type a question, get a chart. Your numbers answered in seconds — no formulas, no waiting on an analyst." },
  { icon: Send, title: "Reports that come to you", body: "Daily, weekly and monthly summaries delivered to email and Telegram — WhatsApp coming soon." },
  { icon: Smartphone, title: "Any device, one price", body: "Desktop, tablet, phone — sharp everywhere. Invite your whole team on a single subscription, not per seat." },
  { icon: Target, title: "Targets & pacing built in", body: "Working-day targets, holiday-aware pacing and red/amber/green signals on every metric that matters." },
  { icon: ShieldCheck, title: "Secure by design", body: "Organisation-scoped access, roles and row-level security. Your data stays yours, always." },
];

const PLANS = [
  { name: "Starter", tagline: "Get out of spreadsheets.", features: ["Up to 3 users", "CSV + data connectors", "4-hour data refresh", "50 AI questions / month", "All core dashboards"], highlight: false },
  { name: "Pro", tagline: "Run the business on numbers.", features: ["Up to 10 users", "Everything in Starter", "PDF export", "Hourly data refresh", "Daily & weekly report emails", "300 AI questions / month"], highlight: true },
  { name: "Ultra", tagline: "Everything, for everyone.", features: ["Unlimited users", "Everything in Pro", "15-minute data refresh", "Monthly & quarterly reviews", "WhatsApp delivery", "1,000 AI questions / month", "Build-your-own views"], highlight: false },
];

export function VantageLanding() {
  return (
    <div className="min-h-screen bg-white" style={{ color: INK }}>
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-[#EAF2F4] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <VantageLogo size={28} />
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex" style={{ color: SLATE }}>
            <a href="#features" className="transition hover:text-[#0E6478]">Features</a>
            <a href="#plans" className="transition hover:text-[#0E6478]">Plans</a>
            <a href="#contact" className="transition hover:text-[#0E6478]">Contact</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden text-sm font-semibold text-[#0E6478] transition hover:text-[#0C4A5A] sm:block">Sign in</Link>
            <a href="#contact" className="v-btn v-btn-primary !h-10 !text-sm">Request a demo</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(900px 500px at 78% -8%, #DDF1F5 0%, transparent 60%), radial-gradient(700px 400px at 0% 0%, #F0FAFB 0%, transparent 55%)" }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="min-w-0">
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-[#CFE7EC] bg-[#F4FBFC] px-3 py-1 text-xs font-semibold" style={{ color: BRAND }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#18A8C4" }} /> Reporting, reinvented for teams
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-5 text-[2.15rem] font-extrabold leading-[1.07] tracking-tight sm:text-[3.4rem]">
              Turn messy data into dashboards your <span className="v-grad-text">whole team</span> actually reads.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: SLATE }}>
              Vantage connects your sales, finance and operations data, cleans it, and keeps it live — then lets anyone ask questions in plain language and get answers on any device. One subscription for your entire team.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#contact" className="v-btn v-btn-primary">Request a demo <ArrowRight className="h-4 w-4" /></a>
              <a href="#features" className="v-btn v-btn-ghost">See how it works</a>
            </motion.div>
            <p className="mt-5 text-sm" style={{ color: "#7e98a0" }}>No per-seat licences · Invite your whole team · Live on every device</p>
          </div>
          <div className="min-w-0 lg:pl-6"><HeroVisual /></div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-y border-[#EEF5F6] bg-[#F9FCFD]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm font-medium" style={{ color: SLATE }}>Running live, every day — built with <b style={{ color: INK }}>KRDM Innovative Homeware</b>.</p>
          <p className="text-sm" style={{ color: "#8aa3aa" }}>Replacing spreadsheet exports & per-seat report licences.</p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: "#18A8C4" }}>What Vantage does</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">One workspace, from raw data to the right decision.</h2>
          <p className="mt-3 text-lg" style={{ color: SLATE }}>Everything you need to see your business clearly — and nothing you don&apos;t.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-2xl border border-[#E6EFF1] bg-white p-6 transition hover:border-[#BFE0E7] hover:shadow-[0_18px_40px_-24px_rgba(12,74,90,0.35)]">
                <div className="grid h-11 w-11 place-items-center rounded-xl transition group-hover:scale-105" style={{ background: "linear-gradient(135deg,#0E6478,#18A8C4)" }}>
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: SLATE }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INTEGRATIONS / DEVICES band */}
      <section className="bg-[#0C4A5A] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Meet your team where they work.</h2>
            <p className="mt-3 text-lg text-[#bfe0e7]">Reports and answers shouldn&apos;t live behind one login on one screen. Vantage shows up everywhere your team already is.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MessageCircle, label: "Telegram", note: "Available now" },
              { icon: MessageCircle, label: "WhatsApp", note: "Coming soon" },
              { icon: Mail, label: "Email digests", note: "Daily · weekly · monthly" },
              { icon: Monitor, label: "Web & mobile", note: "Any device" },
            ].map((c) => (
              <Reveal key={c.label}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                  <c.icon className="h-6 w-6 text-[#36C6DD]" />
                  <p className="mt-3 font-bold">{c.label}</p>
                  <p className="text-sm text-[#9ec7d0]">{c.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section id="plans" className="mx-auto max-w-6xl px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: "#18A8C4" }}>Plans</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">One subscription. Your whole team.</h2>
          <p className="mt-3 text-lg" style={{ color: SLATE }}>Every plan includes the full dashboard suite, target management and access on any device. Pick the cadence and team size that fit.</p>
        </Reveal>
        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Reveal key={p.name}>
              <div className={`relative h-full rounded-2xl border p-7 ${p.highlight ? "border-[#0E6478] shadow-[0_24px_60px_-30px_rgba(14,100,120,0.6)]" : "border-[#E6EFF1]"}`} style={p.highlight ? { background: "linear-gradient(180deg,#FBFEFE,#F4FBFC)" } : { background: "#fff" }}>
                {p.highlight && <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "#0E6478" }}>Most popular</span>}
                <h3 className="text-xl font-extrabold">{p.name}</h3>
                <p className="mt-1 text-sm" style={{ color: SLATE }}>{p.tagline}</p>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((ft) => (
                    <li key={ft} className="flex items-start gap-2 text-[15px]" style={{ color: INK }}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#18A8C4" }} /> {ft}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className={`v-btn mt-6 w-full justify-center ${p.highlight ? "v-btn-primary" : "v-btn-ghost"}`}>Contact us for pricing</a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-[#EEF5F6] bg-[#F9FCFD]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.14em]" style={{ color: "#18A8C4" }}>Get a vantage point</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">See your business clearly — book a walkthrough.</h2>
            <p className="mt-4 text-lg" style={{ color: SLATE }}>Tell us about your data and how your team reports today. We&apos;ll show you Vantage on your numbers and map out what going live looks like.</p>
            <ul className="mt-7 space-y-3">
              {["A live demo on data like yours", "A plan recommendation for your team", "No obligation, no hard sell"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[15px] font-medium" style={{ color: INK }}>
                  <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: "#0E6478" }}><Check className="h-3 w-3 text-white" /></span>{t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-[#E3EEF0] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(12,74,90,0.4)] sm:p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#EAF2F4] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <VantageLogo size={26} />
              <p className="mt-3 text-sm" style={{ color: SLATE }}>See your business clearly. One workspace for every report, on every device.</p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-bold" style={{ color: INK }}>Product</p>
                <ul className="mt-3 space-y-2" style={{ color: SLATE }}>
                  <li><a href="#features" className="hover:text-[#0E6478]">Features</a></li>
                  <li><a href="#plans" className="hover:text-[#0E6478]">Plans</a></li>
                  <li><Link href="/login" className="hover:text-[#0E6478]">Sign in</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-bold" style={{ color: INK }}>Company</p>
                <ul className="mt-3 space-y-2" style={{ color: SLATE }}>
                  <li><a href="#contact" className="hover:text-[#0E6478]">Contact</a></li>
                </ul>
              </div>
              <div>
                <p className="font-bold" style={{ color: INK }}>Legal</p>
                <ul className="mt-3 space-y-2" style={{ color: SLATE }}>
                  <li><Link href="/terms" className="hover:text-[#0E6478]">Terms</Link></li>
                  <li><Link href="/privacy" className="hover:text-[#0E6478]">Privacy</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-[#EEF5F6] pt-6 text-sm" style={{ color: "#8aa3aa" }}>
            © {new Date().getFullYear()} Vantage · iAutomateDev. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
