"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function login() {
    if (loading) return;

    if (!username.trim()) {
      alert("Username wajib diisi");
      return;
    }

    if (!password.trim()) {
      alert("Password wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const json = await res.json();

      console.log("LOGIN RESPONSE :", json);

      if (!res.ok || !json.success) {
        alert(json.message || "Username atau password salah");
        return;
      }

      // =========================================================
      // REDIRECT BERDASARKAN ROLE
      // =========================================================
      const role = String(json.user?.role || "")
        .trim()
        .toUpperCase();

      console.log("LOGIN ROLE :", role);

      // =========================================================
      // KASIR
      // =========================================================
      if (role === "KASIR") {
        router.replace("/outlet/pos");
        router.refresh();
        return;
      }

      // =========================================================
      // ADMIN OUTLET
      // =========================================================
      if (
        role === "OUTLET_ADMIN" ||
        role === "ADMIN_OUTLET"
      ) {
        router.replace("/outlet/dashboard");
        router.refresh();
        return;
      }

      // =========================================================
      // ROLE PUSAT
      // =========================================================
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("LOGIN ERROR :", error);

      alert("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  function enter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      login();
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06130f] text-white">
      {/* =======================================================
          BACKGROUND EFFECT
      ======================================================= */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[550px] w-[550px] rounded-full bg-green-400/10 blur-[140px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/5 blur-[100px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "45px 45px",
          }}
        />
      </div>

      {/* =======================================================
          MAIN
      ======================================================= */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[460px]">

          {/* ===================================================
              BRAND
          =================================================== */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-emerald-300/20 bg-white/[0.07] shadow-[0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-300 via-emerald-500 to-green-700 shadow-lg shadow-emerald-900/40">
                <span className="text-2xl font-black tracking-tight text-white">
                  MGB
                </span>
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-[0.08em] text-white sm:text-3xl">
              PT. MITRA GARAM BOGATAMA
            </h1>

            <div className="mx-auto mt-3 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-emerald-500/40" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                Enterprise Management System
              </p>
              <span className="h-px w-8 bg-emerald-500/40" />
            </div>
          </div>

          {/* ===================================================
              LOGIN CARD
          =================================================== */}
          <div className="rounded-[30px] border border-white/10 bg-white/[0.065] p-[1px] shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="rounded-[29px] border border-white/[0.04] bg-[#0b1c17]/90 px-6 py-7 sm:px-8 sm:py-9">

              {/* Header */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white">
                  Selamat Datang
                </h2>

                <p className="mt-1.5 text-sm leading-6 text-slate-400">
                  Masuk ke sistem untuk melanjutkan aktivitas Anda.
                </p>
              </div>

              {/* =================================================
                  USERNAME
              ================================================= */}
              <div className="mb-5">
                <label
                  htmlFor="username"
                  className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300"
                >
                  Username
                </label>

                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="text-slate-500 transition-colors group-focus-within:text-emerald-400"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>

                  <input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={enter}
                    disabled={loading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/20 focus:border-emerald-400/60 focus:bg-black/30 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* =================================================
                  PASSWORD
              ================================================= */}
              <div className="mb-7">
                <label
                  htmlFor="password"
                  className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300"
                >
                  Password
                </label>

                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="text-slate-500 transition-colors group-focus-within:text-emerald-400"
                    >
                      <rect
                        width="18"
                        height="11"
                        x="3"
                        y="11"
                        rx="2"
                      />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={enter}
                    disabled={loading}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/20 pl-12 pr-12 text-sm text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/20 focus:border-emerald-400/60 focus:bg-black/30 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition-colors hover:text-emerald-400 disabled:opacity-50"
                  >
                    {showPassword ? (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m3 3 18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A9.9 9.9 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.4" />
                        <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 8 10 8a9.8 9.8 0 0 0 3.3-.6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* =================================================
                  LOGIN BUTTON
              ================================================= */}
              <button
                type="button"
                onClick={login}
                disabled={loading}
                className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 text-sm font-bold tracking-wide text-white shadow-[0_12px_35px_rgba(16,185,129,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(16,185,129,0.32)] active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                {loading ? (
                  <span className="relative flex items-center gap-3">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Sedang Login...
                  </span>
                ) : (
                  <span className="relative flex items-center gap-2">
                    Masuk ke Sistem
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </span>
                )}
              </button>

              {/* =================================================
                  SECURITY INDICATOR
              ================================================= */}
              <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-emerald-500/70"
                >
                  <rect
                    width="18"
                    height="11"
                    x="3"
                    y="11"
                    rx="2"
                  />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>

                <span>Secure Enterprise Access</span>
              </div>
            </div>
          </div>

          {/* ===================================================
              FOOTER
          =================================================== */}
          <div className="mt-7 text-center">
            <p className="text-[11px] tracking-wide text-slate-600">
              © {new Date().getFullYear()} PT. Mitra Garam Bogatama
            </p>

            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-700">
              MGB ERP • Internal System
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}