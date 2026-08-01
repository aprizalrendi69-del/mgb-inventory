"use client";

import { useEffect, useState } from "react";

import BarangForm from "@/components/master/barang/BarangForm";
import BarangTable from "@/components/master/barang/BarangTable";
import SearchBar from "@/components/master/barang/SearchBar";

export default function BarangPage() {
  const [barang, setBarang] = useState([]);
  const [search, setSearch] = useState("");

  async function loadBarang() {
    const res = await fetch(
      `/api/master/barang?search=${search}`
    );

    const json = await res.json();

    setBarang(json.data);
  }

  useEffect(() => {
    loadBarang();
  }, [search]);

  return (
    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Master Barang
      </h1>

      <BarangForm />

      <div className="mt-8">
        <SearchBar
          search={search}
          setSearch={setSearch}
        />
      </div>

      <BarangTable
        data={barang}
        reload={loadBarang}
      />
    </div>
  );
}