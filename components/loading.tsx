"use client";

import { Loader2 } from "lucide-react";

interface LoadingProps {
  text?: string;
  fullscreen?: boolean;
  compact?: boolean;
}

export default function Loading({
  text = "Memuat data...",
  fullscreen = false,
  compact = false,
}: LoadingProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-6">
        <div className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400/10 blur-md" />

          <Loader2
            className="relative h-4 w-4 animate-spin text-emerald-400"
            strokeWidth={2}
          />
        </div>

        <span className="text-[10px] font-medium tracking-wide text-slate-400">
          {text}
        </span>
      </div>
    );
  }

  const content = (
    <div
      className="
        relative
        flex
        flex-col
        items-center
        justify-center
        overflow-hidden
        rounded-[28px]
        border
        border-white/[0.07]
        bg-[#071f19]
        px-8
        py-12
        shadow-[0_20px_60px_rgba(2,20,15,0.18)]
      "
    >
      {/* =====================================================
          BACKGROUND GLOW
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -left-20
          -top-20
          h-48
          w-48
          rounded-full
          bg-emerald-400/[0.08]
          blur-[80px]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-24
          -right-20
          h-52
          w-52
          rounded-full
          bg-teal-400/[0.06]
          blur-[90px]
        "
      />

      {/* =====================================================
          TOP SHINE
      ===================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-x-10
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-emerald-300/[0.18]
          to-transparent
        "
      />

      {/* =====================================================
          LOADING ORBIT
      ===================================================== */}

      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* outer glow */}

        <div
          className="
            absolute
            inset-0
            animate-pulse
            rounded-full
            bg-emerald-400/[0.055]
            blur-2xl
          "
        />

        {/* outer ring */}

        <div
          className="
            absolute
            inset-1
            rounded-full
            border
            border-emerald-300/[0.07]
          "
        />

        {/* rotating ring */}

        <div
          className="
            absolute
            inset-3
            rounded-full
            border
            border-emerald-300/[0.12]
            border-t-emerald-300/70
            border-r-emerald-300/25
            animate-spin
          "
          style={{
            animationDuration: "1.4s",
          }}
        />

        {/* second rotating ring */}

        <div
          className="
            absolute
            inset-5
            rounded-full
            border
            border-teal-300/[0.10]
            border-b-teal-300/60
            animate-spin
          "
          style={{
            animationDuration: "2s",
            animationDirection: "reverse",
          }}
        />

        {/* center */}

        <div
          className="
            relative
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-xl
            border
            border-emerald-300/[0.15]
            bg-emerald-400/[0.07]
            shadow-[0_0_25px_rgba(16,185,129,0.10)]
          "
        >
          <span
            className="
              h-2
              w-2
              animate-pulse
              rounded-full
              bg-emerald-400
              shadow-[0_0_14px_rgba(52,211,153,0.9)]
            "
          />
        </div>
      </div>

      {/* =====================================================
          BRAND
      ===================================================== */}

      <div className="relative mt-6 flex items-center gap-2">
        <span
          className="
            relative
            flex
            h-1.5
            w-1.5
          "
        >
          <span
            className="
              absolute
              inset-0
              animate-ping
              rounded-full
              bg-emerald-400
              opacity-40
            "
          />

          <span
            className="
              relative
              h-1.5
              w-1.5
              rounded-full
              bg-emerald-400
            "
          />
        </span>

        <span
          className="
            text-[8px]
            font-bold
            uppercase
            tracking-[0.24em]
            text-emerald-300/70
          "
        >
          MGB ERP
        </span>
      </div>

      {/* =====================================================
          TEXT
      ===================================================== */}

      <h2
        className="
          relative
          mt-2
          text-sm
          font-semibold
          tracking-[-0.01em]
          text-white
        "
      >
        {text}
      </h2>

      <p
        className="
          relative
          mt-1.5
          text-[9px]
          font-medium
          tracking-wide
          text-slate-500
        "
      >
        Mohon tunggu sebentar
      </p>

      {/* =====================================================
          SHIMMER LINE
      ===================================================== */}

      <div
        className="
          relative
          mt-6
          h-1
          w-40
          overflow-hidden
          rounded-full
          bg-white/[0.05]
        "
      >
        <div
          className="
            absolute
            inset-y-0
            -left-1/2
            w-1/2
            rounded-full
            bg-gradient-to-r
            from-transparent
            via-emerald-300/60
            to-transparent
            animate-[loadingShimmer_1.5s_ease-in-out_infinite]
          "
        />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="
          fixed
          inset-0
          z-[9999]
          flex
          items-center
          justify-center
          bg-[#041c17]/95
          px-5
          backdrop-blur-xl
        "
      >
        {/* Fullscreen atmosphere */}

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-1/2
            h-[420px]
            w-[420px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-emerald-400/[0.035]
            blur-[120px]
          "
        />

        <div className="relative w-full max-w-md">
          {content}
        </div>
      </div>
    );
  }

  return content;
}