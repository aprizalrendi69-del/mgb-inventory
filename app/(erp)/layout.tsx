"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalChat from "@/components/GlobalChat";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ERPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error("Gagal mengambil data user:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-green-600" />
          <p className="text-sm text-slate-500">
            Memuat aplikasi...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* =====================================================
          SIDEBAR
      ===================================================== */}
      <Sidebar user={user} />

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <div className="flex-1 min-w-0 bg-slate-100">
        <div className="p-6">
          {/* HEADER */}
          <Header />

          {/* PAGE CONTENT */}
          {children}
        </div>
      </div>

      {/* =====================================================
          GLOBAL LIVE CHAT
          Tampil di seluruh halaman ERP
      ===================================================== */}
      <GlobalChat currentUser={user} />
    </div>
  );
}