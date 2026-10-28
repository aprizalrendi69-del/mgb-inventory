"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  CheckCircle2,
  Sparkles,
  Factory,
  Globe2,
  Boxes,
  Activity,
} from "lucide-react";

type CompanyInfo = {
  name?: string;
  companyName?: string;
  logo?: string | null;
  logoUrl?: string | null;
  data?: CompanyInfo;
  company?: CompanyInfo;
};

const DEFAULT_COMPANY_NAME = "PT. MITRA GARAM BOGATAMA";

function readCompanyInfo(payload: unknown): { name: string; logo: string } {
  if (!payload || typeof payload !== "object") {
    return { name: DEFAULT_COMPANY_NAME, logo: "" };
  }

  const root = payload as CompanyInfo;
  const candidates = [root, root.company, root.data, root.data?.company].filter(
    (value): value is CompanyInfo => Boolean(value && typeof value === "object")
  );

  let name = DEFAULT_COMPANY_NAME;
  let logo = "";

  for (const candidate of candidates) {
    const candidateName = candidate.companyName || candidate.name;
    const candidateLogo = candidate.logoUrl || candidate.logo;
    if (candidateName && typeof candidateName === "string") name = candidateName.trim();
    if (candidateLogo && typeof candidateLogo === "string") logo = candidateLogo.trim();
  }

  return { name: name || DEFAULT_COMPANY_NAME, logo };
}

function CompanyMark({
  logo,
  companyName,
  mobile = false,
}: {
  logo: string;
  companyName: string;
  mobile?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const size = mobile ? "h-[66px] w-[66px] rounded-[22px]" : "h-[58px] w-[58px] rounded-[19px]";

  useEffect(() => {
    setImageFailed(false);
  }, [logo]);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-emerald-800/10 bg-gradient-to-br from-white via-emerald-50 to-emerald-100 shadow-[0_14px_38px_rgba(16,100,72,0.13)] dark:border-emerald-200/20 dark:from-emerald-300/20 dark:via-emerald-500/10 dark:to-white/[0.03] dark:shadow-[0_12px_45px_rgba(16,185,129,0.10)] ${size}`}
      aria-label={`Logo ${companyName}`}
    >
      <div className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-emerald-900/[0.07] dark:border-white/[0.06]" />
      {logo && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={`Logo ${companyName}`}
          className="relative z-[1] h-full w-full object-contain p-2.5"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="relative text-[19px] font-black tracking-[-0.08em] text-emerald-800 dark:text-emerald-300">
          MGB
        </span>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState(DEFAULT_COMPANY_NAME);
  const [companyLogo, setCompanyLogo] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCompany() {
      try {
        const response = await fetch("/api/company", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const payload: unknown = await response.json();
        const company = readCompanyInfo(payload);
        if (active) {
          setCompanyName(company.name);
          setCompanyLogo(company.logo);
        }
      } catch (err) {
        // Login tetap dapat digunakan jika profil perusahaan belum tersedia.
        console.warn("Tidak dapat memuat identitas perusahaan:", err);
      }
    }

    void loadCompany();
    return () => {
      active = false;
    };
  }, []);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError("");
    if (!username.trim()) {
      setError("Username wajib diisi.");
      return;
    }
    if (!password.trim()) {
      setError("Password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(
          json?.message ||
            (res.status >= 500
              ? "Terjadi gangguan pada server. Silakan coba kembali."
              : "Username atau password tidak sesuai.")
        );
        return;
      }

      const role = String(json.user?.role || "").trim().toUpperCase();
      let destination = "/dashboard";
      switch (role) {
        case "KASIR":
          destination = "/outlet/pos";
          break;
        case "STAFF_OUTLET":
          destination = "/manufacture";
          break;
        case "OUTLET_ADMIN":
        case "ADMIN_OUTLET":
          destination = "/outlet/dashboard";
          break;
        default:
          destination = "/dashboard";
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f5f8f7] font-sans text-slate-900 selection:bg-emerald-200 selection:text-emerald-950 transition-colors duration-300 dark:bg-[#07110e] dark:text-white dark:selection:bg-emerald-400/30">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-44 h-[520px] w-[520px] rounded-full bg-emerald-300/30 blur-[130px] dark:bg-emerald-500/[0.10]" />
        <div className="absolute -bottom-52 -right-32 h-[620px] w-[620px] rounded-full bg-teal-200/35 blur-[150px] dark:bg-emerald-400/[0.08]" />
        <div className="absolute left-[48%] top-[42%] h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-[120px] dark:bg-amber-300/[0.025]" />
        <div className="absolute inset-0 opacity-[0.45] dark:opacity-[0.035]" style={{ backgroundImage: "linear-gradient(rgba(15, 80, 61, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 80, 61, 0.055) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-[#eaf2ef]/75 dark:from-transparent dark:via-transparent dark:to-[#07110e]/75" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-center justify-center px-4 py-7 sm:px-7 sm:py-10 lg:px-12 xl:px-16">
        <div className="grid w-full max-w-[1240px] items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 xl:gap-20">
          <section className="hidden min-h-[680px] flex-col justify-between py-5 lg:flex">
            <div>
              <div className="flex items-center gap-4">
                <CompanyMark logo={companyLogo} companyName={companyName} />
                <div>
                  <p className="text-[14px] font-extrabold tracking-[0.12em] text-slate-900 dark:text-white">{companyName.replace(/^PT\.?\s*/i, "").toUpperCase()}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.23em] text-emerald-700 dark:text-emerald-400/80">Enterprise Solutions</p>
                </div>
              </div>

              <div className="mt-24 max-w-[580px]">
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-800/10 bg-white/75 px-3.5 py-2 shadow-sm backdrop-blur dark:border-emerald-300/15 dark:bg-emerald-300/[0.06] dark:shadow-none">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-900 dark:text-emerald-200/90">Integrated Business Platform</span>
                </div>
                <h1 className="text-[46px] font-semibold leading-[1.13] tracking-[-0.055em] text-slate-950 xl:text-[60px] dark:text-white">
                  One system.<br />
                  <span className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-emerald-400 dark:to-amber-200">Every operation.</span><br />
                  <span className="text-slate-700 dark:text-white/85">Better control.</span>
                </h1>
                <p className="mt-7 max-w-[450px] text-[14px] leading-7 text-slate-600 dark:text-slate-400">Kelola operasional bisnis dalam satu ekosistem terintegrasi. Akses informasi, pantau aktivitas, dan jalankan pekerjaan dengan lebih terstruktur.</p>
              </div>

              <div className="mt-12 grid max-w-[540px] grid-cols-2 gap-3">
                <div className="group rounded-2xl border border-white/90 bg-white/80 p-4 shadow-[0_8px_28px_rgba(22,65,50,0.045)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_32px_rgba(22,65,50,0.08)] dark:border-white/[0.08] dark:bg-white/[0.025] dark:shadow-none dark:hover:border-emerald-300/20 dark:hover:bg-white/[0.045]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-800/10 bg-emerald-50 dark:border-emerald-300/10 dark:bg-emerald-300/[0.08]"><Factory className="h-[19px] w-[19px] text-emerald-800 dark:text-emerald-300" /></div>
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Operational Control</p><p className="mt-1.5 text-[11px] leading-5 text-slate-600 dark:text-slate-500">Operasional terintegrasi dalam satu alur kerja.</p>
                </div>
                <div className="group rounded-2xl border border-white/90 bg-white/80 p-4 shadow-[0_8px_28px_rgba(22,65,50,0.045)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_32px_rgba(22,65,50,0.08)] dark:border-white/[0.08] dark:bg-white/[0.025] dark:shadow-none dark:hover:border-emerald-300/20 dark:hover:bg-white/[0.045]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-teal-800/10 bg-teal-50 dark:border-amber-200/10 dark:bg-amber-200/[0.07]"><ShieldCheck className="h-[19px] w-[19px] text-teal-800 dark:text-amber-200" /></div>
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Controlled Access</p><p className="mt-1.5 text-[11px] leading-5 text-slate-600 dark:text-slate-500">Hak akses sistem sesuai peran pengguna.</p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-900/[0.06] bg-white/60 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-300"><Activity className="h-4 w-4" /></div>
                <div><p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Satu ekosistem kerja</p><p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-500">Gudang · Outlet · Pengadaan · Produksi</p></div>
                <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-800/10 bg-emerald-50 px-2.5 py-1 dark:border-emerald-300/10 dark:bg-emerald-300/[0.06]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" /><span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Internal</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-emerald-950/10 pt-6 dark:border-white/[0.07]"><div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-500"><Globe2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400/70" /><span>Internal Business Ecosystem</span></div><span className="text-[10px] font-semibold tracking-[0.15em] text-slate-500 dark:text-slate-600">MGB ERP</span></div>
          </section>

          <section className="mx-auto w-full max-w-[470px]">
            <div className="mb-7 flex flex-col items-center text-center lg:hidden">
              <div className="mb-4"><CompanyMark logo={companyLogo} companyName={companyName} mobile /></div>
              <h1 className="text-base font-extrabold tracking-[0.07em] text-slate-900 sm:text-lg dark:text-white">{companyName}</h1>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-300/80">Enterprise Management System</p>
            </div>

            <div className="relative">
              <div className="absolute -inset-[1px] rounded-[30px] bg-gradient-to-br from-emerald-300/70 via-white/80 to-teal-200/70 blur-[1px] dark:from-emerald-300/25 dark:via-white/[0.06] dark:to-amber-200/10" />
              <div className="relative overflow-hidden rounded-[29px] border border-white bg-white/95 shadow-[0_28px_90px_rgba(24,62,48,0.13)] backdrop-blur-2xl dark:border-white/[0.09] dark:bg-[#0b1914]/95 dark:shadow-[0_35px_100px_rgba(0,0,0,0.48)]">
                <div className="h-[3px] w-full bg-gradient-to-r from-emerald-300 via-emerald-600 to-teal-300 dark:from-transparent dark:via-emerald-400/80 dark:to-transparent" />
                <div className="px-6 py-8 sm:px-10 sm:py-10">
                  <div className="mb-8">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-800/10 bg-gradient-to-br from-emerald-50 to-teal-100 dark:border-emerald-300/15 dark:from-emerald-300/[0.12] dark:to-emerald-500/[0.03]"><Fingerprint className="h-6 w-6 text-emerald-800 dark:text-emerald-300" /></div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-800 dark:text-emerald-300/80">Secure Authentication</p>
                    <h2 className="text-[29px] font-bold tracking-[-0.045em] text-slate-950 sm:text-[32px] dark:text-white">Selamat datang<span className="text-emerald-600 dark:text-emerald-400">.</span></h2>
                    <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-400">Masuk menggunakan akun perusahaan Anda untuk melanjutkan.</p>
                  </div>

                  <form onSubmit={login} noValidate>
                    <div className="mb-5">
                      <label htmlFor="username" className="mb-2.5 block text-[11px] font-bold uppercase tracking-[0.13em] text-slate-700 dark:text-slate-300">Username</label>
                      <div className="group relative"><UserRound className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-700 dark:text-slate-500 dark:group-focus-within:text-emerald-300" /><input id="username" name="username" type="text" placeholder="Masukkan username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => { setUsername(e.target.value); if (error) setError(""); }} disabled={loading} className="h-[54px] w-full rounded-[14px] border border-slate-200 bg-slate-50/80 pl-[48px] pr-4 text-[13px] font-medium text-slate-900 outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/[0.09] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.09] dark:bg-[#06100d]/80 dark:text-white dark:placeholder:text-slate-600 dark:hover:border-white/[0.16] dark:focus:border-emerald-400/50 dark:focus:bg-[#07140f] dark:focus:ring-emerald-400/[0.07]" /></div>
                    </div>

                    <div className="mb-5">
                      <div className="mb-2.5 flex items-center justify-between gap-3"><label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-700 dark:text-slate-300">Password</label><span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-500"><LockKeyhole className="h-3 w-3" />Protected</span></div>
                      <div className="group relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-700 dark:text-slate-500 dark:group-focus-within:text-emerald-300" /><input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }} disabled={loading} className="h-[54px] w-full rounded-[14px] border border-slate-200 bg-slate-50/80 pl-[48px] pr-[50px] text-[13px] font-medium text-slate-900 outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/[0.09] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.09] dark:bg-[#06100d]/80 dark:text-white dark:placeholder:text-slate-600 dark:hover:border-white/[0.16] dark:focus:border-emerald-400/50 dark:focus:bg-[#07140f] dark:focus:ring-emerald-400/[0.07]" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={loading} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword} className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 dark:hover:bg-white/[0.04] dark:hover:text-emerald-300 dark:focus-visible:ring-emerald-400/50">{showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button></div>
                    </div>

                    {error && <div role="alert" aria-live="polite" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12px] leading-5 text-red-800 dark:border-red-400/20 dark:bg-red-400/[0.07] dark:text-red-200"><span className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-red-400 text-[10px] font-bold">!</span><p>{error}</p></div>}
                    <div className="mb-7 flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400/80" /><p className="text-[11px] leading-5 text-slate-600 dark:text-slate-500">Gunakan akun resmi yang telah terdaftar.</p></div>
                    <button type="submit" disabled={loading} className="group relative flex h-[55px] w-full items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 px-5 text-[13px] font-bold tracking-[0.025em] text-white shadow-[0_10px_28px_rgba(5,110,76,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_14px_34px_rgba(5,110,76,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:from-emerald-500 dark:via-emerald-400 dark:to-emerald-500 dark:text-[#04140d] dark:shadow-[0_8px_30px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_12px_35px_rgba(16,185,129,0.24)] dark:focus-visible:ring-emerald-300 dark:focus-visible:ring-offset-[#0b1914]">
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                      {loading ? <span className="relative flex items-center gap-3"><span className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-[#04140d]/25 dark:border-t-[#04140d]" />Memverifikasi akun...</span> : <span className="relative flex items-center gap-2.5">Masuk ke Sistem<ArrowRight className="h-[17px] w-[17px] transition-transform duration-200 group-hover:translate-x-1" /></span>}
                    </button>
                  </form>

                  <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-200 pt-5 dark:border-white/[0.07]"><ShieldCheck className="h-[15px] w-[15px] text-emerald-700 dark:text-emerald-400/70" /><p className="text-[10px] font-medium tracking-[0.04em] text-slate-500 dark:text-slate-500">Secure Enterprise Access</p></div>
                </div>
              </div>
            </div>

            <footer className="mt-7 text-center"><p className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-500">© {new Date().getFullYear()} {companyName}</p><p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.23em] text-slate-400 dark:text-slate-600">MGB ERP · Internal System</p></footer>
            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-500 lg:hidden dark:text-slate-600"><Boxes className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400/70" /><span>Gudang · Outlet · Pengadaan · Produksi</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}
