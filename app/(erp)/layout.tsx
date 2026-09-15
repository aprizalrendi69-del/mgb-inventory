"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalChat from "@/components/GlobalChat";
import Loading from "@/components/loading";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ERPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Global modal state.
   *
   * HANYA modal yang sedang terbuka yang boleh
   * menyembunyikan Header + Sidebar.
   *
   * URL / pathname TIDAK digunakan untuk
   * menyembunyikan Header.
   */
  const [modalOpen, setModalOpen] = useState(false);

  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      setLoading(true);

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

  // =====================================================
  // DETECT GLOBAL MODAL STATE
  // =====================================================

  useEffect(() => {
    if (typeof document === "undefined") return;

    const syncModalState = () => {
      const isOpen =
        document.body.dataset.modalOpen === "true";

      setModalOpen(isOpen);
    };

    // Sync pertama kali
    syncModalState();

    /**
     * Pantau perubahan:
     *
     * document.body.dataset.modalOpen
     *
     * Contoh saat modal dibuka:
     *
     * document.body.dataset.modalOpen = "true";
     *
     * Saat modal ditutup:
     *
     * document.body.dataset.modalOpen = "false";
     */
    const observer = new MutationObserver(() => {
      syncModalState();
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-modal-open"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // =====================================================
  // CLOSE SIDEBAR WHEN ROUTE CHANGES
  // =====================================================

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // =====================================================
  // CLOSE SIDEBAR WHEN MODAL OPENS
  // =====================================================

  useEffect(() => {
    if (modalOpen) {
      setSidebarOpen(false);
    }
  }, [modalOpen]);

  // =====================================================
  // LOCK BODY SCROLL
  // =====================================================

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (modalOpen || sidebarOpen) {
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen, sidebarOpen]);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <Loading
        text="Memuat aplikasi..."
        fullscreen
      />
    );
  }

  // =====================================================
  // NO USER
  // =====================================================

  if (!user) {
    return null;
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="relative min-h-screen bg-slate-100">

      {/* =================================================
          SIDEBAR

          Normal:
          - Muncul

          Ketika modal/premium UI dibuka:
          - Hilang
          - Tidak bisa diklik
      ================================================= */}

      <div
        className={`
          relative z-[200]
          transition-all duration-200 ease-out
          ${
            modalOpen
              ? "pointer-events-none invisible opacity-0"
              : "visible opacity-100"
          }
        `}
      >
        <Sidebar
          user={user}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* =================================================
          MAIN APPLICATION
      ================================================= */}

      <main className="relative z-0 min-h-screen w-full bg-slate-100">

        <div className="w-full p-6">

          {/* =================================================
              HEADER

              Header TETAP muncul ketika:

              - masuk halaman Approve
              - masuk halaman Release
              - masuk halaman Terima Barang
              - masuk halaman Tambah Barang

              Header BARU hilang ketika:

              modalOpen === true
          ================================================= */}

          {!modalOpen && (
            <div
              className="
                sticky
                top-0
                z-[100]
                transition-all
                duration-200
                ease-out
              "
            >
              <Header
                onMenuClick={() =>
                  setSidebarOpen((current) => !current)
                }
              />
            </div>
          )}

          {/* =================================================
              PAGE CONTENT
          ================================================= */}

          <div className="relative z-0">
            {children}
          </div>

        </div>
      </main>

      {/* =====================================================
          GLOBAL CHAT

          GlobalChat TIDAK TERGANTUNG modalOpen.

          Jadi tetap muncul ketika:

          - halaman biasa
          - halaman Approve
          - halaman Release
          - halaman Terima Barang
          - halaman Tambah Barang
          - modal terbuka
          - Header menghilang
          - Sidebar menghilang
      ===================================================== */}

      <div
        className="
          pointer-events-none
          fixed
          inset-0
          z-[9990]
        "
      >
        <div className="pointer-events-auto">
          <GlobalChat currentUser={user} />
        </div>
      </div>

    </div>
  );
}