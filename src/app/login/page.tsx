"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left — Brand panel (KRDM magenta, org-specific) */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "#a1145c" }}
      >
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.08]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="login-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-grid)" />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-white" />
            <span className="text-lg font-semibold tracking-tight text-white">
              Vantage
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10 space-y-5"
        >
          <h1 className="text-[2.75rem] font-bold leading-[1.08] tracking-tight text-white">
            Sales intelligence
            <br />
            that drives results.
          </h1>
          <p className="max-w-[340px] text-base leading-relaxed text-white/80">
            Monitor performance, track targets, and make data-driven
            decisions with real-time analytics.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10"
        >
          <p className="text-sm text-white/50">
            Powered by Vantage · Built for sales teams
          </p>
        </motion.div>
      </div>

      {/* Right — Login form */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="w-[342px] min-w-0 max-w-[calc(100vw-48px)] sm:w-[400px]"
        >
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: "#a1145c" }}
            >
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-gray-900">
              Vantage
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Enter your credentials to access the dashboard.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.za"
                required
                autoComplete="email"
                className="box-border w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-colors focus:border-[#a1145c] focus:outline-none focus:ring-2 focus:ring-[#a1145c]/20"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="box-border w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-colors focus:border-[#a1145c] focus:outline-none focus:ring-2 focus:ring-[#a1145c]/20"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="box-border w-full rounded-lg py-3 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "#a1145c" }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-200 pt-6 text-center">
            <p className="text-sm text-gray-400">
              Access is by invitation only. Contact your administrator
              if you need an account.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
