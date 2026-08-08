"use client";

import {
  Bell,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export default function Header() {
  async function logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header
      className="
        mb-6
        flex
        h-[68px]
        items-center
        justify-between
        rounded-2xl
        border
        border-[#DCE8E1]
        bg-white
        px-5
        shadow-[0_3px_14px_rgba(25,65,45,0.05)]
      "
    >
      {/* =====================================================
          LEFT
      ===================================================== */}

      <div className="flex items-center gap-4">

        {/* BRAND ICON */}

        <div
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-[#E8F5ED]
            text-[#238B59]
          "
        >
          <ShieldCheck
            size={19}
            strokeWidth={1.8}
          />
        </div>


        {/* TITLE */}

        <div>

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <h1
              className="
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
              className="text-[#A5B7AE]"
            />

            <span
              className="
                text-[11px]
                font-medium
                text-[#789087]
              "
            >
              ERP Dashboard
            </span>

          </div>


          <p
            className="
              mt-1
              text-[9px]
              font-medium
              uppercase
              tracking-[0.12em]
              text-[#A0B1A9]
            "
          >
            Enterprise Resource Planning
          </p>

        </div>

      </div>


      {/* =====================================================
          RIGHT
      ===================================================== */}

      <div className="flex items-center gap-3">

        {/* SYSTEM STATUS */}

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
            sm:flex
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


        {/* NOTIFICATION */}

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


        {/* DIVIDER */}

        <div
          className="
            hidden
            h-8
            w-px
            bg-[#E4ECE7]
            sm:block
          "
        />


        {/* LOGOUT */}

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