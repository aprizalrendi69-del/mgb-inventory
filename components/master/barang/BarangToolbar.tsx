"use client";

type Props = {
  onAdd: () => void;
  onImport: () => void;
  onTemplate: () => void;
};

export default function BarangToolbar({
  onAdd,
  onImport,
  onTemplate,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">

      <h1 className="text-3xl font-bold">
        Master Barang
      </h1>

      <div className="flex gap-2">

        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          + Barang Baru
        </button>

        <button
          onClick={onImport}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
        >
          Import Excel
        </button>

        <button
          onClick={onTemplate}
          className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
        >
          Download Template
        </button>

      </div>

    </div>
  );
}