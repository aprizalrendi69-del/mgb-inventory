"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";

type PurchaseComment = {
  id: number;
  comment: string;
  createdAt: string;

  user: {
    id: number;
    fullname: string;
    role: string;
    outletId: number | null;
  };
};

type PurchaseCommentsProps = {
  purchaseId: number | string;
  source: "PUSAT" | "OUTLET";
};

export default function PurchaseComments({
  purchaseId,
  source,
}: PurchaseCommentsProps) {
  const [comments, setComments] =
    useState<PurchaseComment[]>([]);

  const [comment, setComment] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const apiUrl =
    source === "PUSAT"
      ? `/api/purchase/${purchaseId}/comments`
      : `/api/outlet/purchase/${purchaseId}/comments`;

  async function loadComments() {
    try {
      setLoading(true);

      const res = await fetch(
        apiUrl,
        {
          cache: "no-store",
        }
      );

      const json =
        await res.json();

      if (
        !res.ok ||
        !json.success
      ) {
        console.error(
          json.message ||
            "Gagal mengambil komentar"
        );

        return;
      }

      setComments(
        json.data || []
      );
    } catch (error) {
      console.error(
        "LOAD PURCHASE COMMENTS ERROR:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [apiUrl]);

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    const text =
      comment.trim();

    if (!text) {
      return;
    }

    if (text.length > 2000) {
      alert(
        "Komentar maksimal 2000 karakter"
      );

      return;
    }

    try {
      setSending(true);

      const res =
        await fetch(apiUrl, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            comment: text,
          }),
        });

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

      setComment("");

      setComments(
        (current) => [
          ...current,
          json.data,
        ]
      );
    } catch (error) {
      console.error(
        "POST PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        "Terjadi kesalahan saat menambahkan komentar"
      );
    } finally {
      setSending(false);
    }
  }

  function formatDate(
    value: string
  ) {
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
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#DDE9E4] bg-white shadow-sm">
      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-[#E5ECE9] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EF] text-[#497F70]">
            <MessageSquare
              size={19}
            />
          </div>

          <div>
            <h2 className="font-semibold text-[#18352D]">
              Komentar PO
            </h2>

            <p className="text-xs text-gray-500">
              Catatan dan komunikasi terkait Purchase Order
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadComments}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE9E4] text-gray-500 hover:bg-[#F5F8F6] disabled:opacity-50"
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

      {/* COMMENTS */}

      <div className="max-h-[420px] space-y-3 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <RefreshCw
              size={17}
              className="mr-2 animate-spin"
            />

            Memuat komentar...
          </div>
        ) : comments.length ===
          0 ? (
          <div className="rounded-xl border border-dashed border-[#DDE9E4] bg-[#FAFCFB] px-5 py-8 text-center">
            <MessageSquare
              size={24}
              className="mx-auto mb-2 text-gray-300"
            />

            <p className="text-sm text-gray-500">
              Belum ada komentar pada PO ini.
            </p>
          </div>
        ) : (
          comments.map(
            (item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#E5ECE9] bg-[#FAFCFB] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#18352D]">
                      {item.user
                        ?.fullname ||
                        "User"}
                    </p>

                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {item.user
                        ?.role ||
                        "-"}
                    </p>
                  </div>

                  <span className="whitespace-nowrap text-[11px] text-gray-400">
                    {formatDate(
                      item.createdAt
                    )}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                  {item.comment}
                </p>
              </div>
            )
          )
        )}
      </div>

      {/* INPUT */}

      <form
        onSubmit={handleSubmit}
        className="border-t border-[#E5ECE9] bg-[#FAFCFB] p-4"
      >
        <div className="flex items-end gap-3">
          <textarea
            value={comment}
            onChange={(e) =>
              setComment(
                e.target.value
              )
            }
            maxLength={2000}
            rows={2}
            placeholder="Tulis komentar pada PO ini..."
            disabled={sending}
            className="min-h-[72px] flex-1 resize-none rounded-xl border border-[#D5E5DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#497F70] focus:ring-2 focus:ring-[#497F70]/10 disabled:bg-gray-100"
          />

          <button
            type="submit"
            disabled={
              sending ||
              !comment.trim()
            }
            className="inline-flex h-[72px] items-center justify-center gap-2 rounded-xl bg-[#497F70] px-5 text-sm font-semibold text-white transition hover:bg-[#3D6D60] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <Send
                size={17}
              />
            )}

            Kirim
          </button>
        </div>

        <div className="mt-2 text-right text-[11px] text-gray-400">
          {comment.length}/2000
        </div>
      </form>
    </div>
  );
}