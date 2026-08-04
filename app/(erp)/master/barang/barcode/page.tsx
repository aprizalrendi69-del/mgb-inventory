"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Barcode from "@/components/barcode/Barcode";

interface Barang {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
}

export default function BarcodePage() {
  const searchParams = useSearchParams();

  const [data, setData] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [searchParams]);

  async function loadData() {
    try {
      setLoading(true);

      const ids = searchParams.get("ids");

      const url = ids
        ? `/api/master/barang/barcode?ids=${ids}`
        : "/api/master/barang/barcode";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error(error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        Memuat barcode...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold">
          Cetak Barcode
        </h1>

        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Print
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {data.map((item) => (
          <div
            key={item.id}
            className="border rounded p-3 text-center"
          >
            <Barcode
              value={item.barcode || item.code}
            />

            <div className="mt-2 font-semibold text-sm">
              {item.name}
            </div>

            <div className="text-xs text-gray-500">
              {item.code}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}