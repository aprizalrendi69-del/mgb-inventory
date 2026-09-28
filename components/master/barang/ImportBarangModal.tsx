"use client";

import { useState } from "react";

type ImportError = {
  row: number;
  code?: string;
  name?: string;
  message: string;
};

type RemovedDetail = {
  id: number;
  code: string;
  name: string;
  message: string;
};

type PreservedDetail = {
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

    /**
     * Jumlah barang lama yang benar-benar
     * dihapus karena belum pernah dipakai
     * transaksi pusat.
     */
    removed?: number;

    /**
     * Backward compatibility jika API lama
     * masih mengirim deactivated.
     */
    deactivated?: number;

    skipped?: number;
    failed?: number;

    errors?: ImportError[];
  };

  summary?: {
    totalExcel?: number;
    baru?: number;
    update?: number;

    /**
     * Barang lama yang dihapus.
     */
    dihapus?: number;

    /**
     * Backward compatibility.
     */
    dinonaktifkan?: number;

    dilewati?: number;
    gagal?: number;
  };

  skippedDetails?: ImportError[];

  failedDetails?: ImportError[];

  /**
   * Detail barang lama yang benar-benar
   * dihapus dari master.
   */
  removedDetails?: RemovedDetail[];

  /**
   * Backward compatibility dengan API lama.
   */
  deactivatedDetails?: RemovedDetail[];

  /**
   * Barang lama yang tidak ada di Excel
   * tetapi dipertahankan karena sudah
   * mempunyai histori transaksi pusat.
   */
  preservedDetails?: PreservedDetail[];
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
     * ATURAN IMPORT:
     *
     * 1. Barang yang ada di Excel baru:
     *    - jika kode sudah ada -> update
     *    - jika belum ada -> buat baru
     *
     * 2. Barang lama yang tidak ada di Excel:
     *    - sudah pernah dipakai transaksi pusat
     *      -> PERTAHANKAN
     *
     *    - belum pernah dipakai transaksi pusat
     *      -> HAPUS
     *
     * 3. Barang OUTLET tidak disentuh.
     *
     * 4. ID barang yang sudah mempunyai
     *    histori transaksi harus dipertahankan.
     */

    const confirmed =
      window.confirm(
        "Import Master Barang baru akan menggantikan daftar master barang CENTRAL. Barang lama yang tidak ada di Excel akan diperiksa berdasarkan histori transaksi pusat: barang yang sudah pernah dipakai transaksi akan DIPERTAHANKAN, sedangkan barang yang belum pernah dipakai transaksi akan DIHAPUS. Barang OUTLET tidak disentuh. Lanjutkan?"
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
       * =====================================================
       * RELOAD
       * =====================================================
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

  /*
   * API BARU:
   * removedDetails
   *
   * API LAMA:
   * deactivatedDetails
   *
   * Keduanya diterima supaya frontend tetap
   * kompatibel saat backend sedang diperbarui.
   */

  const removed =
    result?.removedDetails ||
    result?.deactivatedDetails ||
    [];

  const preserved =
    result?.preservedDetails ||
    [];

  /*
   * =========================================================
   * JUMLAH DIHAPUS
   * =========================================================
   */

  const removedCount =
    data?.removed ??
    data?.deactivated ??
    result?.summary?.dihapus ??
    result?.summary?.dinonaktifkan ??
    removed.length;

  /*
   * =========================================================
   * JUMLAH TOTAL
   * =========================================================
   */

  const total =
    data?.total ??
    result?.summary?.totalExcel ??
    0;

  /*
   * =========================================================
   * JUMLAH BARU
   * =========================================================
   */

  const imported =
    data?.imported ??
    result?.summary?.baru ??
    0;

  /*
   * =========================================================
   * JUMLAH UPDATE
   * =========================================================
   */

  const updated =
    data?.updated ??
    result?.summary?.update ??
    0;

  /*
   * =========================================================
   * JUMLAH DILEWATI
   * =========================================================
   */

  const skipped =
    data?.skipped ??
    result?.summary?.dilewati ??
    0;

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
              Ganti master barang CENTRAL
              menggunakan file Excel baru
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
              CARA KERJA IMPORT
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
                • ID barang lama tetap
                dipertahankan ketika barang
                tersebut sudah mempunyai
                histori transaksi.
              </li>

              <li>
                • Barang baru di Excel akan
                dibuat sebagai barang CENTRAL.
              </li>

              <li>
                • Barang CENTRAL lama yang
                tidak ada di Excel akan
                diperiksa histori transaksinya.
              </li>

              <li>
                • Barang yang sudah pernah
                dipakai transaksi pusat akan
                DIPERTAHANKAN.
              </li>

              <li>
                • Barang yang belum pernah
                dipakai transaksi pusat akan
                DIHAPUS.
              </li>

              <li>
                • Barang OUTLET tidak disentuh.
              </li>

              <li>
                • Histori transaksi tidak
                dihapus.
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
              Perhatian sebelum import
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
                • Spasi berlebih akan
                diabaikan.
              </li>

              <li>
                • Duplikat dalam Excel akan
                dilewati.
              </li>

              <li>
                • Barang lama yang tidak ada
                di Excel TIDAK otomatis
                dihapus semuanya.
              </li>

              <li>
                • Barang yang sudah mempunyai
                transaksi pusat akan tetap
                dipertahankan.
              </li>

              <li>
                • Hanya barang lama yang belum
                pernah dipakai transaksi pusat
                yang boleh dihapus.
              </li>

              <li>
                • Histori transaksi tidak boleh
                ikut terhapus.
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
                    {result.message ||
                      "Master barang berhasil diperbarui."}
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
                        {total}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Total Excel
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
                        {imported}
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
                        {updated}
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

                    {/* DIHAPUS */}

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
                          text-red-600
                        "
                      >
                        {removedCount}
                      </div>

                      <div
                        className="
                          text-[11px]
                          text-gray-500
                        "
                      >
                        Dihapus
                      </div>
                    </div>

                    {/* DILEWATI */}

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
                        {skipped}
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
                  BARANG DIHAPUS
              ============================================= */}

              {removed.length >
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
                      Barang dihapus dari master
                    </div>

                    <div
                      className="
                        mt-0.5
                        text-xs
                        text-red-700
                      "
                    >
                      Barang berikut tidak ada
                      dalam Excel baru dan belum
                      pernah dipakai transaksi
                      pusat.
                    </div>
                  </div>

                  <div
                    className="
                      max-h-56
                      overflow-y-auto
                      bg-white
                    "
                  >
                    {removed.map(
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
                              text-red-600
                            "
                          >
                            {item.message ||
                              "Belum pernah dipakai transaksi pusat dan dihapus dari master."}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* =============================================
                  BARANG DIPERTAHANKAN
              ============================================= */}

              {preserved.length >
                0 && (
                <div
                  className="
                    mt-4
                    overflow-hidden
                    rounded-xl
                    border
                    border-blue-200
                  "
                >
                  <div
                    className="
                      border-b
                      border-blue-200
                      bg-blue-50
                      px-4
                      py-3
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-semibold
                        text-blue-800
                      "
                    >
                      Barang lama dipertahankan
                    </div>

                    <div
                      className="
                        mt-0.5
                        text-xs
                        text-blue-700
                      "
                    >
                      Barang berikut tidak ada
                      dalam Excel baru, tetapi
                      tetap dipertahankan karena
                      sudah mempunyai histori
                      transaksi pusat.
                    </div>
                  </div>

                  <div
                    className="
                      max-h-56
                      overflow-y-auto
                      bg-white
                    "
                  >
                    {preserved.map(
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
                              text-blue-600
                            "
                          >
                            {item.message ||
                              "Dipertahankan karena mempunyai histori transaksi pusat."}
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
                : "Import Master Baru"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}