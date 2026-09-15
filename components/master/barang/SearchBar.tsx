"use client";

export default function SearchBar({
  search,
  setSearch,
}: {
  search: string;
  setSearch: any;
}) {
  return (
    <input
      className="border rounded p-2 w-80"
      placeholder="Cari barang..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
}