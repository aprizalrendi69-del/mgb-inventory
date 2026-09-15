"use client";

import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  // =========================================================
  // GLOBAL MODAL STATE
  //
  // Komponen Header akan otomatis menghilang ketika ada
  // premium modal yang membuka:
  //
  // document.body.dataset.modalOpen = "true";
  //
  // Saat ditutup:
  //
  // delete document.body.dataset.modalOpen;
  // =========================================================

  const [modalOpen, setModalOpen] =
    useState(false);

  // =========================================================
  // DETECT GLOBAL MODAL
  // =========================================================

  useEffect(() => {
    if (
      typeof document === "undefined"
    ) {
      return;
    }

    const syncModalState = () => {
      const isOpen =
        document.body.dataset.modalOpen ===
        "true";

      setModalOpen(isOpen);
    };

    // Check kondisi awal
    syncModalState();

    // Pantau perubahan attribute body
    const observer =
      new MutationObserver(() => {
        syncModalState();
      });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "data-modal-open",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // =========================================================
  // HEARTBEAT
  // =========================================================

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/me/heartbeat", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
      } catch {
        // Abaikan error heartbeat
      }
    };

    sendHeartbeat();

    const interval = setInterval(
      sendHeartbeat,
      15000
    );

    return () => clearInterval(interval);
  }, []);

  // =========================================================
  // LOGOUT
  // =========================================================

  async function logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  // =========================================================
  // HEADER
  //
  // IMPORTANT:
  // Ketika modal terbuka, kita menggunakan:
  //
  // hidden
  //
  // bukan hanya opacity-0.
  //
  // Dengan begitu Header benar-benar keluar dari layout/render
  // visual dan tidak mungkin menutupi modal.
  // =========================================================

  return (
    <header
      className={`
        mb-6
        flex
        h-[68px]
        w-full
        items-center
        justify-between
        rounded-2xl
        border
        border-[#DCE8E1]
        bg-white
        px-5
        shadow-[0_3px_14px_rgba(25,65,45,0.05)]
        ${
          modalOpen
            ? "hidden"
            : "flex"
        }
      `}
    >
      {/* =====================================================
          LEFT
      ===================================================== */}

      <div className="flex min-w-0 items-center gap-3">

        {/* =================================================
            MENU BUTTON
        ================================================= */}

        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Buka menu"
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            border-[#E0EAE4]
            bg-white
            text-[#71877D]
            transition-all
            duration-150
            hover:border-[#C8DDD0]
            hover:bg-[#F5FAF7]
            hover:text-[#238B59]
            active:scale-95
          "
        >
          <Menu
            size={19}
            strokeWidth={1.9}
          />
        </button>

        {/* =================================================
            BRAND ICON
        ================================================= */}

        <div
          className="
            hidden
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-[#E8F5ED]
            text-[#238B59]
            sm:flex
          "
        >
          <div className="flex items-center justify-center">
            <span className="text-[13px] font-black tracking-[-0.04em]">
              MGB
            </span>
          </div>
        </div>

        {/* =================================================
            TITLE
        ================================================= */}

        <div className="min-w-0">

          <div className="flex min-w-0 items-center gap-2">

            <h1
              className="
                truncate
                text-[14px]
                font-semibold
                tracking-[-0.01em]
                text-[#20352C]
              "
            >
              PT. MITRA GARAM BOGATAMA
            </h1>

            <ChevronRight
              size={13}
              className="
                hidden
                shrink-0
                text-[#A5B7AE]
                sm:block
              "
            />

            <span
              className="
                hidden
                shrink-0
                text-[11px]
                font-medium
                text-[#789087]
                sm:block
              "
            >
              ERP Dashboard
            </span>

          </div>

          <p
            className="
              mt-1
              hidden
              text-[9px]
              font-medium
              uppercase
              tracking-[0.12em]
              text-[#A0B1A9]
              sm:block
            "
          >
            Enterprise Resource Planning
          </p>

        </div>
      </div>

      {/* =====================================================
          RIGHT
      ===================================================== */}

      <div className="flex shrink-0 items-center gap-3">

        {/* =================================================
            SYSTEM ONLINE
        ================================================= */}

        <div
          className="
            hidden
            items-center
            gap-2
            rounded-full
            border
            border-[#DDEBE2]
            bg-[#F5FAF7]
            px-3
            py-2
            md:flex
          "
        >
          <span
            className="
              h-1.5
              w-1.5
              rounded-full
              bg-[#43B979]
              shadow-[0_0_6px_rgba(67,185,121,0.45)]
            "
          />

          <span
            className="
              text-[9px]
              font-semibold
              tracking-wide
              text-[#658076]
            "
          >
            SYSTEM ONLINE
          </span>
        </div>

        {/* =================================================
            NOTIFICATION
        ================================================= */}

        <button
          type="button"
          className="
            relative
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            border
            border-[#E0EAE4]
            bg-white
            text-[#71877D]
            transition
            hover:border-[#C8DDD0]
            hover:bg-[#F5FAF7]
            hover:text-[#238B59]
          "
          aria-label="Notifikasi"
        >
          <Bell
            size={17}
            strokeWidth={1.8}
          />

          <span
            className="
              absolute
              right-[9px]
              top-[8px]
              h-1.5
              w-1.5
              rounded-full
              bg-[#43B979]
            "
          />
        </button>

        {/* =================================================
            DIVIDER
        ================================================= */}

        <div
          className="
            hidden
            h-8
            w-px
            bg-[#E4ECE7]
            sm:block
          "
        />

        {/* =================================================
            LOGOUT
        ================================================= */}

        <button
          type="button"
          onClick={logout}
          className="
            group
            flex
            h-10
            items-center
            gap-2
            rounded-xl
            border
            border-[#E0E8E4]
            bg-white
            px-3.5
            text-[#6D7F76]
            transition-all
            duration-150
            hover:border-[#F0CFCF]
            hover:bg-[#FFF7F7]
            hover:text-[#C45353]
          "
        >
          <LogOut
            size={16}
            strokeWidth={1.8}
            className="
              transition
              group-hover:translate-x-0.5
            "
          />

          <span
            className="
              hidden
              text-[10px]
              font-semibold
              sm:block
            "
          >
            Logout
          </span>
        </button>

      </div>
    </header>
  );
}