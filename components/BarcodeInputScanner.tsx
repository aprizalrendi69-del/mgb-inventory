"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (barcode: string) => void;
}

export default function BarcodeInputScanner({
  onScan,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKey(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();

    const code = value.trim();

    if (!code) {
      return;
    }

    console.log("USB/Bluetooth BARCODE:", code);

    onScan(code);

    setValue("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Barcode Scanner USB / Bluetooth
      </label>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Scan barcode..."
        autoComplete="off"
        className="
          w-full
          rounded-lg
          border
          border-gray-300
          px-3
          py-2
          outline-none
          focus:border-[#497F70]
          focus:ring-2
          focus:ring-[#497F70]/10
        "
      />

      <p className="mt-1 text-xs text-gray-400">
        Bisa menggunakan scanner USB atau Bluetooth
        yang bekerja sebagai keyboard.
      </p>
    </div>
  );
}