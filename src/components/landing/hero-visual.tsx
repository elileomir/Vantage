"use client";

// Animated hero mockup: a tilted "live" dashboard (counting KPIs + growing bars + drawing line)
// with a floating chatbot card that types a question and reveals an answer — purely UI elements,
// no real data/video. The "wow" piece that intrigues without claiming a feature is live.

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, TrendingUp, ArrowUpRight } from "lucide-react";

function useCountUp(target: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setV(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const bars = [42, 58, 35, 70, 52, 88, 64];

function Dashboard() {
  const rev = useCountUp(1.21);
  const cust = useCountUp(202);
  return (
    <div className="w-[420px] max-w-full rounded-2xl border border-[#E3EEF0] bg-white p-5 shadow-[0_30px_70px_-30px_rgba(12,74,90,0.45)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "#16804b", animation: "v-blink 1.6s infinite" }} />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#51707A]">Executive Summary · Live</span>
        </div>
        <span className="rounded-md bg-[#EAF6F8] px-2 py-0.5 text-[10px] font-semibold text-[#0E6478]">FY 2026</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Revenue MTD", value: `R${rev.toFixed(2)}M`, sub: "▲ 18%" },
          { label: "Target pace", value: "102%", sub: "On track" },
          { label: "Customers", value: String(Math.round(cust)), sub: "▲ 12" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-[#F4FBFC] p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7e98a0]">{k.label}</p>
            <p className="mt-0.5 text-[15px] font-bold tabular-nums text-[#0A2A31]">{k.value}</p>
            <p className="text-[10px] font-medium text-[#127D92]">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-[120px] items-end gap-2.5 rounded-xl bg-gradient-to-b from-[#F4FBFC] to-white p-3">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 rounded-t-md"
            style={{ background: i === 5 ? "linear-gradient(#18A8C4,#0E6478)" : "#Bfe3ea" }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[#51707A]">
        <span className="flex items-center gap-1 font-medium text-[#127D92]"><TrendingUp className="h-3.5 w-3.5" /> Sales rep achievement</span>
        <span className="flex items-center gap-1 font-semibold text-[#0A2A31]">124% <ArrowUpRight className="h-3 w-3 text-[#16804b]" /></span>
      </div>
    </div>
  );
}

const QUESTION = "Which rep is furthest behind target this month?";

function Chatbot() {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "thinking" | "answer">("typing");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const push = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
    let i = 0;
    const run = () => {
      setTyped(""); setPhase("typing"); i = 0;
      const type = () => {
        i += 1; setTyped(QUESTION.slice(0, i));
        if (i < QUESTION.length) push(type, 45);
        else { push(() => setPhase("thinking"), 500); push(() => setPhase("answer"), 1500); push(run, 7000); }
      };
      push(type, 400);
    };
    run();
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  return (
    <div className="w-[320px] max-w-full rounded-2xl border border-[#E3EEF0] bg-white p-4 shadow-[0_24px_60px_-24px_rgba(12,74,90,0.5)]">
      <div className="mb-3 flex items-center gap-2 border-b border-[#EFF6F7] pb-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg,#0E6478,#18A8C4)" }}>
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-[#0A2A31]">Ask Vantage</span>
      </div>

      {/* user question (typing) */}
      <div className="mb-2 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#0E6478] px-3 py-1.5 text-[13px] text-white">
        {typed}
        {phase === "typing" && <span style={{ animation: "v-blink 1s infinite" }}>▍</span>}
      </div>

      {/* assistant answer */}
      {phase !== "typing" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-[#F4FBFC] px-3 py-2 text-[13px] text-[#0A2A31]">
          {phase === "thinking" ? (
            <span className="flex gap-1 py-1">
              {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full bg-[#9fc4cd]" style={{ animation: `v-blink 1s ${d * 0.2}s infinite` }} />)}
            </span>
          ) : (
            <>
              <p><b>Crystal Jumat</b> — 29% of target (<span className="text-[#c4321c]">−R136k</span>).</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e0eef1]"><div className="h-full rounded-full" style={{ width: "29%", background: "#c4321c" }} /></div>
                <span className="text-[11px] font-semibold text-[#51707A]">29%</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#51707A]">3 customers driving the gap. Want the breakdown?</p>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-fit" style={{ perspective: "1400px" }}>
      <motion.div
        initial={{ opacity: 0, rotateY: 14, rotateX: 8, y: 24 }}
        animate={{ opacity: 1, rotateY: -8, rotateX: 6, y: 0 }}
        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <Dashboard />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7 }}
        className="absolute -bottom-10 -left-12 hidden sm:block"
        style={{ animation: "v-float 6s ease-in-out infinite" }}
      >
        <Chatbot />
      </motion.div>
    </div>
  );
}
