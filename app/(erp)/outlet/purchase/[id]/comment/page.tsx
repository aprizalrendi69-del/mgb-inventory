"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  MessageSquare,
  ShoppingCart,
} from "lucide-react";

type User = {
  id: number;
  fullname: string;
  role: string;
  outletId?: number | null;
};

type Comment = {
  id: number;
  comment: string;
  createdAt: string;
  user: User;
};

type Purchase = {
  id: number;
  number: string;
  outletId: number;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export default function PurchaseOutletCommentPage() {
  const router = useRouter();
  const params = useParams();

  const id = String(params.id);

  // =====================================================
  // STATE
  // =====================================================

  const [purchase, setPurchase] =
    useState<Purchase | null>(null);

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [comment, setComment] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  // =====================================================
  // LOAD
  // =====================================================

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      // ===============================================
      // PURCHASE
      // ===============================================

      const purchaseRes =
        await fetch(
          `/api/outlet/purchase/${id}`,
          {
            cache: "no-store",
          }
        );

      const purchaseJson =
        await purchaseRes.json();

      if (
        !purchaseRes.ok ||
        !purchaseJson.success
      ) {
        alert(
          purchaseJson.message ||
            "Purchase Outlet tidak ditemukan"
        );

        router.push(
          "/outlet/purchase"
        );

        return;
      }

      setPurchase(
        purchaseJson.data
      );

      // ===============================================
      // COMMENTS
      // ===============================================

      const commentRes =
        await fetch(
          `/api/outlet/purchase/${id}/comment`,
          {
            cache: "no-store",
          }
        );

      const commentJson =
        await commentRes.json();

      if (
        !commentRes.ok ||
        !commentJson.success
      ) {
        alert(
          commentJson.message ||
            "Gagal mengambil komentar"
        );

        return;
      }

      setComments(
        commentJson.data || []
      );
    } catch (error) {
      console.error(
        "LOAD OUTLET PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Gagal mengambil data komentar Purchase Outlet"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(
    value: string
  ) {
    try {
      return new Date(
        value
      ).toLocaleString(
        "id-ID",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    } catch {
      return value;
    }
  }

  // =====================================================
  // ROLE LABEL
  // =====================================================

  function roleLabel(
    role: string
  ) {
    switch (role) {
      case "ADMIN":
        return "Admin";

      case "MANAGER":
        return "Manager";

      case "PURCHASING":
        return "Purchasing";

      case "OUTLET_ADMIN":
        return "Outlet Admin";

      default:
        return role;
    }
  }

  // =====================================================
  // SEND COMMENT
  // =====================================================

  async function handleSendComment() {
    const value =
      comment.trim();

    if (!value) {
      alert(
        "Komentar tidak boleh kosong"
      );

      return;
    }

    if (value.length > 2000) {
      alert(
        "Komentar maksimal 2000 karakter"
      );

      return;
    }

    if (sending) {
      return;
    }

    try {
      setSending(true);

      const res =
        await fetch(
          `/api/outlet/purchase/${id}/comment`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              comment: value,
            }),
          }
        );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        alert(
          json.message ||
            "Gagal menambahkan komentar"
        );

        return;
      }

      // =============================================
      // LANGSUNG TAMBAHKAN KE LIST
      // TANPA RELOAD
      // =============================================

      if (json.data) {
        setComments(
          (current) => [
            ...current,
            json.data,
          ]
        );
      } else {
        await loadData();
      }

      setComment("");
    } catch (error) {
      console.error(
        "SEND OUTLET PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menambahkan komentar"
      );
    } finally {
      setSending(false);
    }
  }

  // =====================================================
  // ENTER TO SEND
  // =====================================================

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      handleSendComment();
    }
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <RefreshCw
              size={22}
              className="animate-spin text-[#497F70]"
            />

            Memuat komentar Purchase Outlet...
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // PURCHASE NOT FOUND
  // =====================================================

  if (!purchase) {
    return null;
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-full bg-[#F6F8F7] p-6 md:p-8">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">

          {/* BACK */}

          <button
            type="button"
            onClick={() =>
              router.push(
                `/outlet/purchase/${id}`
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#DDE9E4] bg-white text-gray-600 shadow-sm transition hover:bg-[#F5F8F6]"
          >
            <ArrowLeft size={20} />
          </button>

          {/* ICON */}

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#497F70] text-white">
            <MessageSquare
              size={23}
            />
          </div>

          {/* TITLE */}

          <div>
            <h1 className="text-2xl font-bold text-[#18352D] md:text-3xl">
              Komentar Purchase Outlet
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {purchase.number}
            </p>
          </div>

        </div>

        {/* PURCHASE INFO */}

        <div className="flex items-center gap-3">

          <div className="hidden rounded-xl border border-[#DDE9E4] bg-white px-4 py-2.5 shadow-sm sm:block">
            <div className="flex items-center gap-2">
              <ShoppingCart
                size={17}
                className="text-[#497F70]"
              />

              <div>
                <p className="text-xs text-gray-400">
                  Purchase Order
                </p>

                <p className="text-sm font-semibold text-[#18352D]">
                  {purchase.number}
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* =================================================
          PURCHASE INFO
      ================================================= */}

      <div className="mb-6 rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        <div className="border-b border-[#E5ECE9] px-5 py-4">

          <h2 className="font-semibold text-[#18352D]">
            Informasi Purchase Order
          </h2>

        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">

          {/* NOMOR */}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Nomor PO
            </p>

            <p className="text-sm font-semibold text-[#18352D]">
              {purchase.number}
            </p>
          </div>

          {/* OUTLET */}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">
              Outlet
            </p>

            <p className="text-sm font-semibold text-[#18352D]">
              {purchase.outlet
                ? `${purchase.outlet.code} - ${purchase.outlet.name}`
                : `Outlet #${purchase.outletId}`}
            </p>
          </div>

        </div>

      </div>

      {/* =================================================
          COMMENT CONTAINER
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">

          <div>

            <h2 className="font-semibold text-[#18352D]">
              Comment / Diskusi
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {comments.length} komentar
            </p>

          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE9E4] bg-white text-gray-500 transition hover:bg-[#F5F8F6] disabled:opacity-50"
            title="Refresh komentar"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
          </button>

        </div>

        {/* =================================================
            COMMENT LIST
        ================================================= */}

        <div className="max-h-[520px] overflow-y-auto px-5 py-5">

          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F6F3] text-[#497F70]">
                <MessageSquare
                  size={25}
                />
              </div>

              <p className="font-medium text-gray-600">
                Belum ada komentar
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Tambahkan komentar untuk Purchase Order ini.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {comments.map(
                (item) => (
                  <div
                    key={
                      item.id
                    }
                    className="rounded-xl border border-[#E5ECE9] bg-[#FAFCFB] p-4"
                  >

                    {/* USER */}

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#497F70] text-sm font-bold text-white">
                          {item.user.fullname
                            ?.charAt(
                              0
                            )
                            ?.toUpperCase() ||
                            "U"}
                        </div>

                        <div>

                          <p className="text-sm font-semibold text-[#18352D]">
                            {
                              item.user
                                .fullname
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-gray-400">
                            {roleLabel(
                              item.user
                                .role
                            )}
                          </p>

                        </div>

                      </div>

                      <span className="shrink-0 text-xs text-gray-400">
                        {formatDate(
                          item.createdAt
                        )}
                      </span>

                    </div>

                    {/* COMMENT */}

                    <div className="mt-3 rounded-lg bg-white px-4 py-3 text-sm leading-6 text-gray-700 whitespace-pre-wrap">
                      {
                        item.comment
                      }
                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>

        {/* =================================================
            INPUT
        ================================================= */}

        <div className="border-t border-[#E5ECE9] bg-[#FAFCFB] p-5">

          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Tambahkan Komentar
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">

            <div className="flex-1">

              <textarea
                value={
                  comment
                }
                onChange={(e) =>
                  setComment(
                    e.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                disabled={
                  sending
                }
                rows={3}
                maxLength={2000}
                placeholder="Tulis komentar untuk Purchase Order ini..."
                className="w-full resize-none rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
              />

              <div className="mt-1 flex justify-between">

                <p className="text-xs text-gray-400">
                  Enter untuk kirim · Shift + Enter untuk baris baru
                </p>

                <p className="text-xs text-gray-400">
                  {comment.length}/2000
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={
                handleSendComment
              }
              disabled={
                sending ||
                !comment.trim()
              }
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
            >

              {sending ? (
                <>
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />

                  Mengirim...
                </>
              ) : (
                <>
                  <Send
                    size={17}
                  />

                  Kirim
                </>
              )}

            </button>

          </div>

        </div>

      </div>

      {/* =================================================
          BOTTOM
      ================================================= */}

      <div className="mt-6 flex justify-end">

        <button
          type="button"
          onClick={() =>
            router.push(
              `/outlet/purchase/${id}`
            )
          }
          className="rounded-xl border border-[#D5E5DC] bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-[#F5F8F6]"
        >
          Kembali ke Purchase Order
        </button>

      </div>

    </div>
  );
}