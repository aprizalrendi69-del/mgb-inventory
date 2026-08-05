"use client";

import { useEffect, useRef, useState } from "react";

interface Props {

  onScan: (barcode: string) => Promise<void> | void;

}

export default function BarcodeInputScanner({

  onScan

}: Props) {

  const inputRef =
    useRef<HTMLInputElement>(null);

  const timerRef =
    useRef<NodeJS.Timeout | null>(null);

  const [value, setValue] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {

    focusInput();

    const interval =
      setInterval(() => {

        focusInput();

      }, 1000);

    return () => {

      clearInterval(interval);

      if (timerRef.current) {

        clearTimeout(timerRef.current);

      }

    };

  }, []);

  function focusInput() {

    if (!loading) {

      inputRef.current?.focus();

    }

  }

  async function submit(barcode: string) {

    const code =
      barcode.trim();

    if (!code || loading) {

      return;

    }

    try {

      setLoading(true);

      await onScan(code);

    } finally {

      setValue("");

      setLoading(false);

      setTimeout(() => {

        focusInput();

      }, 50);

    }

  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const text =
      e.target.value;

    setValue(text);

    if (timerRef.current) {

      clearTimeout(timerRef.current);

    }

    timerRef.current =
      setTimeout(() => {

        if (text.trim().length >= 4) {

          submit(text);

        }

      }, 80);

  }

  return (

    <div className="bg-white rounded-xl shadow border p-6">

      <div className="flex items-center justify-between mb-5">

        <div>

          <h2 className="text-lg font-bold">

            Scanner Barcode USB / Bluetooth

          </h2>

          <p className="text-sm text-gray-500 mt-1">

            Scanner akan otomatis membaca barcode tanpa klik tombol.

          </p>

        </div>

        <div
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            loading
              ? "bg-orange-100 text-orange-600"
              : "bg-green-100 text-green-600"
          }`}
        >

          {loading ? "Scanning..." : "Ready"}

        </div>

      </div>

      <input

        ref={inputRef}

        value={value}

        autoFocus

        autoComplete="off"

        spellCheck={false}

        disabled={loading}

        placeholder="Scan barcode di sini..."

        onChange={handleChange}

        onKeyDown={(e) => {

          if (e.key === "Enter") {

            e.preventDefault();

            submit(value);

          }

        }}

        className="
        w-full
        border-2
        border-blue-500
        rounded-xl
        px-5
        py-4
        text-2xl
        font-semibold
        tracking-wider
        focus:outline-none
        focus:ring-4
        focus:ring-blue-200
        disabled:bg-gray-100
        "

      />

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">

        <div className="bg-blue-50 rounded-lg p-3">

          <div className="font-semibold text-blue-700">

            Mode

          </div>

          <div>

            USB / Bluetooth Scanner

          </div>

        </div>

        <div className="bg-green-50 rounded-lg p-3">

          <div className="font-semibold text-green-700">

            Status

          </div>

          <div>

            {loading ? "Memproses..." : "Siap Scan"}

          </div>

        </div>

      </div>

      <p className="text-xs text-gray-500 mt-5">

        Sebagian besar barcode scanner akan otomatis mengirim tombol ENTER setelah barcode selesai dibaca. Komponen ini juga mendukung mode Auto Scan tanpa ENTER.

      </p>

    </div>

  );

}