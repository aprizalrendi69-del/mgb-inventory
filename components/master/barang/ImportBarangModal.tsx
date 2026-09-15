"use client";

import { useState } from "react";

type ImportError = {
  row: number;
  code?: string;
  name?: string;
  message: string;
};

type DeactivatedDetail = {
  id: number;
  code: string;
  name: string;
  message: string;
};

type ImportResult = {
  success: boolean;
  message?: string;

  data?: {
    total?: number;
    imported?: number;
    updated?: number;
    deactivated?: number;
    skipped?: number;
    failed?: number;
    errors?: ImportError[];
  };

  summary?: {
    totalExcel?: number;
    baru?: number;
    update?: number;
    dinonaktifkan?: number;
    dilewati?: number;
    gagal?: number;
  };

  skippedDetails?: ImportError[];

  failedDetails?: ImportError[];

  deactivatedDetails?: DeactivatedDetail[];
};

export default function ImportBarangModal({
  open,
  onClose,
  reload,
}: {
  open: boolean;
  onClose: () => void;
  reload: () => void;
}) {
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<ImportResult | null>(null);

  /*
   * =========================================================
   * RESET
   * =========================================================
   */

  function resetModal() {
    setFile(null);
    setResult(null);
    setLoading(false);
  }

  /*
   * =========================================================
   * CLOSE
   * =========================================================
   */

  function handleClose() {
    if (loading) return;

    resetModal();

    onClose();
  }

  /*
   * =========================================================
   * FILE CHANGE
   * =========================================================
   */

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0] || null;

    setFile(selectedFile);

    setResult(null);
  }

  /*
   * =========================================================
   * IMPORT
   * =========================================================
   */

  async function handleImport() {
    if (!file) {
      alert(
        "Pilih file Excel terlebih dahulu"
      );

      return;
    }

    /*
     * =======================================================
     * VALIDASI EXTENSION
     * =======================================================
     */

    const fileName =
      file.name.toLowerCase();

    if (
      !fileName.endsWith(".xlsx") &&
      !fileName.endsWith(".xls")
    ) {
      alert(
        "File harus berformat Excel (.xlsx atau .xls)"
      );

      return;
    }

    /*
     * =======================================================
     * KONFIRMASI
     * =======================================================
     *
     * Karena barang lama yang tidak ada di Excel
     * akan otomatis menjadi inactive.
     *
     * Data TIDAK dihapus.
     */

    const confirmed =
      window.confirm(
        "Import ini akan memperbarui master barang berdasarkan Excel baru. Barang CENTRAL lama yang tidak ada di Excel akan otomatis dinonaktifkan, tetapi TIDAK dihapus dan histori transaksi tetap aman. Lanjutkan?"
      );

    if (!confirmed) {
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    try {
      setLoading(true);

      setResult(null);

      const res =
        await fetch(
          "/api/master/barang/import",
          {
            method: "POST",
            body: formData,
          }
        );

      let json: ImportResult;

      try {
        json = await res.json();
      } catch {
        throw new Error(
          "Response server tidak valid"
        );
      }

      /*
       * =====================================================
       * SIMPAN HASIL
       * =====================================================
       */

      setResult(json);

      /*
       * Reload hanya jika request
       * benar-benar berhasil.
       */

      if (
        json.success
      ) {
        reload();
      }
    } catch (error) {
      console.error(
        "IMPORT BARANG ERROR:",
        error
      );

      setResult({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menghubungi server",
      });
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * JANGAN RENDER
   * =========================================================
   */

  if (!open) return null;

  /*
   * =========================================================
   * DATA RESULT
   * =========================================================
   */

  const data =
    result?.data;

  const errors =
    result?.data?.errors ||
    [];

  const deactivated =
    result?.deactivatedDetails ||
    [];

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/40
        p-4
      "
    >
      <div
        className="
          w-full
          max-w-[620px]
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
        "
      >
        {/* ===================================================
            HEADER
        =================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-[#E5ECE9]
            px-6
            py-5
          "
        >
          <div>
            <h2
              className="
                text-xl
                font-bold
                text-[#18352D]
              "
            >
              Import Master Barang
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              Import master barang pusat dari
              file Excel
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              text-xl
              text-gray-400
              transition
              hover:bg-gray-100
              hover:text-gray-700
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            ✕
          </button>
        </div>

        {/* ===================================================
            BODY
        =================================================== */}

        <div
          className="
            max-h-[70vh]
            overflow-y-auto
            p-6
          "
        >
          {/* =================================================
              PENJELASAN IMPORT
          ================================================= */}

          <div
            className="
              mb-5
              rounded-xl
              border
              border-[#DDE9E4]
              bg-[#F5F8F6]
              p-4
            "
          >
            <div
              className="
                mb-2
                text-sm
                font-bold
                text-[#18352D]
              "
            >
              Cara kerja import
            </div>

            <ul
              className="
                space-y-1
                text-xs
                leading-5
                text-gray-600
              "
            >
              <li>
                • Barang dengan kode yang sama
                akan di-update.
              </li>

              <li>
                • Barang dengan nama yang sama
                tidak akan dibuat duplikat.
              </li>

              <li>
                • Barang baru akan dibuat sebagai
                barang CENTRAL.
              </li>

              <li>
                • Barang CENTRAL lama yang tidak
                ada di Excel akan otomatis
                dinonaktifkan.
              </li>

              <li>
                • Barang lama TIDAK dihapus.
              </li>

              <li>
                • Barang OUTLET tidak disentuh.
              </li>

              <li>
                • ID barang lama dipertahankan
                agar histori transaksi tetap aman.
              </li>
            </ul>
          </div>

          {/* =================================================
              PERINGATAN
          ================================================= */}

          <div
            className="
              mb-5
              rounded-xl
              border
              border-amber-200
              bg-amber-50
              p-4
            "
          >
            <div
              className="
                mb-2
                text-sm
                font-bold
                text-amber-800
              "
            >
              Perhatian
            </div>

            <ul
              className="
                space-y-1
                text-xs
                leading-5
                text-amber-700
              "
            >
              <li>
                • Kode barang harus unik.
              </li>

              <li>
                • Nama barang harus unik.
              </li>

              <li>
                • Huruf besar/kecil tidak
                dibedakan.
              </li>

              <li>
                • Spasi berlebih akan diabaikan.
              </li>

              <li>
                • Duplikat dalam Excel akan
                dilewati.
              </li>

              <li>
                • Barang lama yang tidak ada di
                Excel menjadi inactive, bukan
                dihapus.
              </li>
            </ul>
          </div>

          {/* =================================================
              FILE
          ================================================= */}

          <div>
            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-[#18352D]
              "
            >
              File Excel
            </label>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={loading}
              className="
                w-full
                cursor-pointer
                rounded-xl
                border
                border-[#D5E5DC]
                bg-white
                p-2.5
                text-sm
                text-gray-600
                file:mr-3
                file:rounded-lg
                file:border-0
                file:bg-[#EAF3EF]
                file:px-3
                file:py-2
                file:text-sm
                file:font-semibold
                file:text-[#497F70]
                hover:border-[#497F70]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            />
          </div>

          {/* =================================================
              SELECTED FILE
          ================================================= */}

          {file && (
            <div
              className="
                mt-3
                rounded-xl
                border
                border-[#DDE9E4]
                bg-[#FAFCFB]
                px-4
                py-3
                text-sm
                text-gray-600
              "
            >
              <div
                className="
                  text-xs
                  text-gray-400
                "
              >
                File dipilih
              </div>

              <div
                className="
                  mt-1
                  break-all
                  font-semibold
                  text-[#18352D]
                "
              >
                {file.name}
              </div>
            </div>
          )}

          {/* =================================================
              RESULT
          ================================================= */}

          {result && (
            <div className="mt-5">
              {/* =============================================
                  SUCCESS
              ============================================= */}

              {result.success && (
                <div
                  className="
                    rounded-xl
                    border
                    border-green-200
                    bg-green-50
                    p-4
                  "
                >
                  <div
                    className="
                      font-semibold
                      text-green-800
                    "
                  >
                    Import selesai
                  </div>

                  <div
                    className="
                      mt-1
                      text-xs
                      text-green-700
                    "
                  >
                    {result.message}
                  </div>

                  {/* =======================================
                      SUMMARY
                  ======================================= */}

                  <div
                    className="
                      mt-4
                      grid
                      grid-cols-2
                      gap-2
                      sm:grid-cols-5
                    "
                  >
                    {/* TOTAL */}

                    <div
                      className="
                        rounded-lg
                        bg-white
                        p-3
                        text-center
                      "
                    >
                      <div
                        className="
                          text-lg
                          font-bold
                          text-[#18352D]
                        "
                      >
                        {data?.total ??
                          0}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Total
                      </div>
                    </div>

                    {/* BARU */}

                    <div
                      className="
                        rounded-lg
                        bg-white
                        p-3
                        text-center
                      "
                    >
                      <div
                        className="
                          text-lg
                          font-bold
                          text-green-600
                        "
                      >
                        {data?.imported ??
                          0}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Baru
                      </div>
                    </div>

                    {/* UPDATE */}

                    <div
                      className="
                        rounded-lg
                        bg-white
                        p-3
                        text-center
                      "
                    >
                      <div
                        className="
                          text-lg
                          font-bold
                          text-blue-600
                        "
                      >
                        {data?.updated ??
                          0}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Update
                      </div>
                    </div>

                    {/* NONAKTIF */}

                    <div
                      className="
                        rounded-lg
                        bg-white
                        p-3
                        text-center
                      "
                    >
                      <div
                        className="
                          text-lg
                          font-bold
                          text-amber-600
                        "
                      >
                        {data?.deactivated ??
                          0}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Nonaktif
                      </div>
                    </div>

                    {/* DUPLIKAT */}

                    <div
                      className="
                        rounded-lg
                        bg-white
                        p-3
                        text-center
                      "
                    >
                      <div
                        className="
                          text-lg
                          font-bold
                          text-orange-600
                        "
                      >
                        {data?.skipped ??
                          0}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Dilewati
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================
                  ERROR
              ============================================= */}

              {!result.success && (
                <div
                  className="
                    rounded-xl
                    border
                    border-red-200
                    bg-red-50
                    p-4
                  "
                >
                  <div
                    className="
                      font-semibold
                      text-red-800
                    "
                  >
                    Import gagal
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      text-red-700
                    "
                  >
                    {result.message ||
                      "File tidak dapat diimport"}
                  </div>
                </div>
              )}

              {/* =============================================
                  BARANG NONAKTIF
              ============================================= */}

              {deactivated.length >
                0 && (
                <div
                  className="
                    mt-4
                    overflow-hidden
                    rounded-xl
                    border
                    border-amber-200
                  "
                >
                  <div
                    className="
                      border-b
                      border-amber-200
                      bg-amber-50
                      px-4
                      py-3
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-semibold
                        text-amber-800
                      "
                    >
                      Barang otomatis
                      dinonaktifkan
                    </div>

                    <div
                      className="
                        mt-0.5
                        text-xs
                        text-amber-700
                      "
                    >
                      Barang tidak ditemukan
                      dalam Excel baru. Data
                      tetap disimpan.
                    </div>
                  </div>

                  <div
                    className="
                      max-h-56
                      overflow-y-auto
                      bg-white
                    "
                  >
                    {deactivated.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="
                            border-b
                            border-gray-100
                            px-4
                            py-3
                            last:border-b-0
                          "
                        >
                          <div
                            className="
                              text-sm
                              font-semibold
                              text-[#18352D]
                            "
                          >
                            {item.name}
                          </div>

                          <div
                            className="
                              mt-0.5
                              text-xs
                              text-gray-500
                            "
                          >
                            Kode:{" "}
                            {item.code}
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              text-amber-600
                            "
                          >
                            {item.message}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* =============================================
                  ERROR / DUPLICATE LIST
              ============================================= */}

              {errors.length >
                0 && (
                <div
                  className="
                    mt-4
                    overflow-hidden
                    rounded-xl
                    border
                    border-red-200
                  "
                >
                  <div
                    className="
                      border-b
                      border-red-200
                      bg-red-50
                      px-4
                      py-3
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-semibold
                        text-red-800
                      "
                    >
                      Data yang dilewati
                      / ditolak
                    </div>
                  </div>

                  <div
                    className="
                      max-h-56
                      overflow-y-auto
                    "
                  >
                    {errors.map(
                      (
                        error,
                        index
                      ) => (
                        <div
                          key={`${error.row}-${index}`}
                          className="
                            border-b
                            border-gray-100
                            px-4
                            py-3
                            last:border-b-0
                          "
                        >
                          <div
                            className="
                              flex
                              items-start
                              justify-between
                              gap-3
                            "
                          >
                            <div>
                              <div
                                className="
                                  text-xs
                                  font-semibold
                                  text-gray-400
                                "
                              >
                                Baris{" "}
                                {
                                  error.row
                                }
                              </div>

                              <div
                                className="
                                  mt-0.5
                                  text-sm
                                  font-semibold
                                  text-[#18352D]
                                "
                              >
                                {error.name ||
                                  "-"}
                              </div>

                              {error.code && (
                                <div
                                  className="
                                    text-xs
                                    text-gray-500
                                  "
                                >
                                  Kode:{" "}
                                  {
                                    error.code
                                  }
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              leading-5
                              text-red-600
                            "
                          >
                            {
                              error.message
                            }
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <div
          className="
            flex
            justify-end
            gap-3
            border-t
            border-[#E5ECE9]
            bg-[#FAFCFB]
            px-6
            py-4
          "
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="
              rounded-xl
              border
              border-[#D5E5DC]
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-gray-600
              transition
              hover:bg-[#F5F8F6]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {result?.success
              ? "Tutup"
              : "Batal"}
          </button>

          {!result?.success && (
            <button
              type="button"
              onClick={handleImport}
              disabled={
                loading ||
                !file
              }
              className="
                rounded-xl
                bg-[#497F70]
                px-5
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-[#3E6E61]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading
                ? "Mengimport..."
                : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}