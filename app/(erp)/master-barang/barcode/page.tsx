"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import JsBarcode from "jsbarcode";

interface Barang {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  unit?: string | null;
}

export default function BarcodePage() {
  const searchParams = useSearchParams();

  const idsParam = searchParams.get("ids");

  const [barang, setBarang] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadData() {
    try {
      if (!idsParam) {
        setBarang([]);
        setLoading(false);
        return;
      }

      const ids = idsParam
        .split(",")
        .map(Number)
        .filter((id) => !isNaN(id));

      const res = await fetch("/api/master/barang?search=");

      if (!res.ok) {
        throw new Error("Gagal mengambil data barang");
      }

      const json = await res.json();

      const allBarang = json.data || [];

      const selectedBarang = allBarang.filter((item: Barang) =>
        ids.includes(Number(item.id))
      );

      setBarang(selectedBarang);
    } catch (error) {
      console.error("Gagal load barcode:", error);
      setBarang([]);
    } finally {
      setLoading(false);
    }
  }

  loadData();
}, [idsParam]);

  useEffect(() => {
    if (!barang.length) return;

    setTimeout(() => {
      barang.forEach((item) => {
        const value = item.barcode || item.code;

        const element = document.getElementById(
          `barcode-${item.id}`
        ) as SVGElement | null;

        if (!element || !value) return;

        try {
          JsBarcode(element, value, {
            format: "CODE128",
            width: 2,
            height: 55,
            displayValue: true,
            fontSize: 13,
            margin: 5,
          });
        } catch (error) {
          console.error(
            `Gagal membuat barcode untuk ${item.name}:`,
            error
          );
        }
      });
    }, 100);
  }, [barang]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 30,
          fontFamily: "Arial",
        }}
      >
        Memuat barcode...
      </div>
    );
  }

  if (!barang.length) {
    return (
      <div
        style={{
          padding: 30,
          fontFamily: "Arial",
        }}
      >
        <h2>Data barcode tidak ditemukan</h2>

        <button
          onClick={() => window.history.back()}
          style={{
            marginTop: 15,
            padding: "10px 18px",
            cursor: "pointer",
          }}
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="no-print toolbar">
        <button onClick={handlePrint}>🖨 Cetak Barcode</button>

        <button onClick={() => window.history.back()}>
          ← Kembali
        </button>
      </div>

      <div className="barcode-container">
        {barang.map((item) => (
          <div className="barcode-label" key={item.id}>
            <div className="item-name">
              {item.name}
            </div>

            <svg id={`barcode-${item.id}`} />

            <div className="item-code">
              {item.code}
            </div>

            {item.unit && (
              <div className="item-unit">
                {item.unit}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f3f4f6;
          font-family: Arial, sans-serif;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          padding: 15px;
          background: white;
          border-bottom: 1px solid #ddd;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .toolbar button {
          border: none;
          background: #111827;
          color: white;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .toolbar button:hover {
          opacity: 0.85;
        }

        .barcode-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 20px;
        }

        .barcode-label {
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 12px;
          min-height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          page-break-inside: avoid;
        }

        .item-name {
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 5px;
          max-width: 100%;
        }

        .item-code {
          font-size: 12px;
          margin-top: 2px;
          font-weight: bold;
        }

        .item-unit {
          font-size: 11px;
          color: #555;
          margin-top: 2px;
        }

        svg {
          max-width: 100%;
          height: auto;
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          body {
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .barcode-container {
            padding: 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5mm;
          }

          .barcode-label {
            border: 1px solid #000;
            border-radius: 0;
            min-height: 35mm;
            padding: 3mm;
          }
        }

        @media screen and (max-width: 800px) {
          .barcode-container {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </>
  );
}