"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AtSign,
  Check,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

// =========================================================
// TYPES
// =========================================================

type MentionUser = {
  id: number;
  fullname: string;
  role: string;
  outletId: number | null;
  active?: boolean;
};

type PurchaseCommentMention = {
  id: number;
  userId: number;
  createdAt: string;
  user: MentionUser;
};

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
  mentions?: PurchaseCommentMention[];
};

type SelectedMention = {
  id: number;
  fullname: string;
  token: string;
};

type PurchaseCommentsProps = {
  purchaseId: number | string;
  source: "PUSAT" | "OUTLET";
};

type UserApiResponse = {
  id?: number;
  fullname?: string;
  name?: string;
  username?: string;
  role?: string;
  outletId?: number | null;
  active?: boolean;
};

type MeUser = {
  id?: number;
  fullname?: string;
  name?: string;
  username?: string;
  role?: string;
  outletId?: number | null;
};

type MeApiResponse = {
  success?: boolean;
  data?: MeUser;
  user?: MeUser;
  id?: number;
  fullname?: string;
  name?: string;
  username?: string;
  role?: string;
  outletId?: number | null;
};

// =========================================================
// COMPONENT
// =========================================================

export default function PurchaseComments({
  purchaseId,
  source,
}: PurchaseCommentsProps) {
  const [comments, setComments] = useState<PurchaseComment[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<
    SelectedMention[]
  >([]);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  // =========================================================
  // CURRENT USER
  // =========================================================

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(false);

  // =========================================================
  // DELETE STATE
  // =========================================================

  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(
    null
  );

  // =========================================================
  // REFS
  // =========================================================

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionBoxRef = useRef<HTMLDivElement | null>(null);

  // =========================================================
  // API URL
  // =========================================================

  const apiUrl = useMemo(() => {
    const id = encodeURIComponent(String(purchaseId));

    return source === "PUSAT"
      ? `/api/purchase/${id}/comment`
      : `/api/outlet/purchase/${id}/comment`;
  }, [purchaseId, source]);

  // =========================================================
  // LOAD CURRENT USER
  // =========================================================

  async function loadCurrentUser() {
    try {
      setLoadingCurrentUser(true);

      const res = await fetch("/api/me", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        setCurrentUserId(null);
        return;
      }

      const json = (await res.json()) as MeApiResponse;

      const user = json.data || json.user || json;

      const id = Number(user?.id);

      if (Number.isInteger(id) && id > 0) {
        setCurrentUserId(id);
      } else {
        setCurrentUserId(null);
      }
    } catch (error) {
      console.error("LOAD CURRENT USER ERROR:", error);
      setCurrentUserId(null);
    } finally {
      setLoadingCurrentUser(false);
    }
  }

  // =========================================================
  // LOAD COMMENTS
  // =========================================================

  async function loadComments() {
    try {
      setLoading(true);

      const res = await fetch(apiUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        console.error(
          json?.message || "Gagal mengambil komentar"
        );

        setComments([]);
        return;
      }

      const rawComments = Array.isArray(json.data)
        ? json.data
        : [];

      setComments(rawComments as PurchaseComment[]);
    } catch (error) {
      console.error(
        "LOAD PURCHASE COMMENTS ERROR:",
        error
      );

      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD USERS FOR MENTION
  // =========================================================

  async function loadMentionUsers() {
    try {
      setLoadingUsers(true);

      const res = await fetch("/api/user/online", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        console.error(
          json?.message || "Gagal mengambil daftar user"
        );

        return;
      }

      const rawUsers = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.users)
          ? json.users
          : [];

      const normalizedUsers = rawUsers
        .map(
          (item: UserApiResponse): MentionUser | null => {
            const id = Number(item?.id);

            const fullname = String(
              item?.fullname ||
                item?.name ||
                item?.username ||
                ""
            ).trim();

            if (
              !Number.isInteger(id) ||
              id <= 0 ||
              !fullname
            ) {
              return null;
            }

            return {
              id,
              fullname,
              role: String(item?.role || "-"),
              outletId: item?.outletId ?? null,
              active: item?.active !== false,
            };
          }
        )
        .filter(
          (item): item is MentionUser =>
            item !== null
        );

      const uniqueUsers = Array.from(
        new Map(
          normalizedUsers.map((item) => [
            item.id,
            item,
          ])
        ).values()
      );

      setUsers(uniqueUsers);
    } catch (error) {
      console.error(
        "LOAD MENTION USERS ERROR:",
        error
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    void loadComments();
  }, [apiUrl]);

  useEffect(() => {
    void loadMentionUsers();
    void loadCurrentUser();
  }, []);

  // =========================================================
  // FILTER MENTION USERS
  // =========================================================

  const filteredMentionUsers = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();

    const selectedIds = new Set(
      selectedMentions.map((item) => item.id)
    );

    return users
      .filter((user) => user.active !== false)
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) => {
        if (!query) {
          return true;
        }

        return (
          user.fullname
            .toLowerCase()
            .includes(query) ||
          user.role
            .toLowerCase()
            .includes(query)
        );
      })
      .slice(0, 8);
  }, [
    users,
    mentionQuery,
    selectedMentions,
  ]);

  // =========================================================
  // DETECT @ MENTION
  // =========================================================

  function detectMention(
    value: string,
    cursorPosition: number
  ) {
    const beforeCursor = value.slice(
      0,
      cursorPosition
    );

    /*
     * Detect:
     *
     * @
     * @ren
     * halo @Rendi
     *
     * Tetapi tidak mendeteksi:
     *
     * email@test.com
     */

    const match = beforeCursor.match(
      /(^|\s)@([^\s@]*)$/
    );

    if (!match) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }

    const atIndex =
      beforeCursor.lastIndexOf("@");

    if (atIndex < 0) {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      return;
    }

    const query = beforeCursor.slice(
      atIndex + 1
    );

    setMentionStart(atIndex);
    setMentionQuery(query);
    setMentionOpen(true);
    setActiveMentionIndex(0);
  }

  // =========================================================
  // TEXTAREA CHANGE
  // =========================================================

  function handleCommentChange(value: string) {
    setComment(value);

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    detectMention(
      value,
      textarea.selectionStart
    );
  }

  // =========================================================
  // TEXTAREA CLICK
  // =========================================================

  function handleTextareaClick() {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    detectMention(
      textarea.value,
      textarea.selectionStart
    );
  }

  // =========================================================
  // TEXTAREA KEY UP
  // =========================================================

  function handleTextareaKeyUp(
    e: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Enter" ||
      e.key === "Escape"
    ) {
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    detectMention(
      textarea.value,
      textarea.selectionStart
    );
  }

  // =========================================================
  // SELECT MENTION
  // =========================================================

  function selectMention(user: MentionUser) {
    const textarea = textareaRef.current;

    if (
      !textarea ||
      mentionStart === null
    ) {
      return;
    }

    const cursorPosition =
      textarea.selectionStart;

    const before = comment.slice(
      0,
      mentionStart
    );

    const after = comment.slice(
      cursorPosition
    );

    const token = `@${user.fullname}`;

    const newComment =
      `${before}${token} ${after}`;

    const nextCursor =
      before.length +
      token.length +
      1;

    setComment(newComment);

    setSelectedMentions((current) => {
      const exists = current.some(
        (item) => item.id === user.id
      );

      if (exists) {
        return current;
      }

      return [
        ...current,
        {
          id: user.id,
          fullname: user.fullname,
          token,
        },
      ];
    });

    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      const element =
        textareaRef.current;

      if (!element) {
        return;
      }

      element.focus();
      element.selectionStart =
        nextCursor;
      element.selectionEnd =
        nextCursor;
    });
  }

  // =========================================================
  // KEYBOARD NAVIGATION MENTION
  // =========================================================

  function handleMentionKeyDown(
    e: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      !mentionOpen ||
      filteredMentionUsers.length === 0
    ) {
      if (
        e.key === "Escape" &&
        mentionOpen
      ) {
        e.preventDefault();

        setMentionOpen(false);
        setMentionStart(null);
        setMentionQuery("");
      }

      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();

      setActiveMentionIndex(
        (current) =>
          current + 1 >=
          filteredMentionUsers.length
            ? 0
            : current + 1
      );

      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();

      setActiveMentionIndex(
        (current) =>
          current - 1 < 0
            ? filteredMentionUsers.length - 1
            : current - 1
      );

      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const user =
        filteredMentionUsers[
          activeMentionIndex
        ];

      if (user) {
        selectMention(user);
      }

      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();

      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      setActiveMentionIndex(0);
    }
  }

  // =========================================================
  // VALID MENTION IDS
  // =========================================================

  function getValidMentionIds(
    text: string
  ) {
    return selectedMentions
      .filter((mention) =>
        text.includes(mention.token)
      )
      .map((mention) => mention.id);
  }

  // =========================================================
  // SUBMIT
  // =========================================================

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const text = comment.trim();

    if (!text) {
      return;
    }

    if (text.length > 2000) {
      alert(
        "Komentar maksimal 2000 karakter"
      );

      return;
    }

    const mentionedUserIds =
      getValidMentionIds(text);

    try {
      setSending(true);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          comment: text,
          mentionedUserIds,
        }),
      });

      const json = await res
        .json()
        .catch(() => null);

      if (
        !res.ok ||
        !json?.success
      ) {
        alert(
          json?.message ||
            "Gagal menambahkan komentar"
        );

        return;
      }

      setComment("");
      setSelectedMentions([]);
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      setActiveMentionIndex(0);

      if (json.data) {
        setComments((current) => [
          ...current,
          json.data as PurchaseComment,
        ]);
      } else {
        await loadComments();
      }
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

  // =========================================================
  // DELETE COMMENT
  // =========================================================

  async function handleDeleteComment(
    item: PurchaseComment
  ) {
    /*
     * FRONTEND UX CHECK ONLY.
     *
     * Security sebenarnya WAJIB dicek lagi
     * oleh backend DELETE route.
     *
     * Backend harus memastikan:
     *
     * if (existingComment.userId !== user.id) {
     *   return 403;
     * }
     */

    if (loadingCurrentUser) {
      alert(
        "Data user sedang dimuat. Silakan coba lagi."
      );

      return;
    }

    if (currentUserId === null) {
      alert(
        "Data user belum tersedia. Silakan login ulang atau coba lagi."
      );

      return;
    }

    const commentUserId =
      Number(item.user?.id);

    const loggedInUserId =
      Number(currentUserId);

    if (
      !Number.isInteger(commentUserId) ||
      commentUserId <= 0 ||
      commentUserId !== loggedInUserId
    ) {
      alert(
        "Anda hanya dapat menghapus komentar yang Anda buat."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Hapus komentar ini?\n\nKomentar yang sudah dihapus tidak dapat dikembalikan."
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCommentId(item.id);

      const deleteUrl =
        `${apiUrl}/${encodeURIComponent(
          String(item.id)
        )}`;

      const res = await fetch(
        deleteUrl,
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

      const json = await res
        .json()
        .catch(() => null);

      if (
        !res.ok ||
        json?.success === false
      ) {
        throw new Error(
          json?.message ||
            "Gagal menghapus komentar"
        );
      }

      setComments((current) =>
        current.filter(
          (commentItem) =>
            commentItem.id !==
            item.id
        )
      );
    } catch (error) {
      console.error(
        "DELETE PURCHASE COMMENT ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menghapus komentar"
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  // =========================================================
  // FORMAT DATE
  // =========================================================

  function formatDate(value: string) {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  // =========================================================
  // ESCAPE REGEX
  // =========================================================

  function escapeRegExp(
    value: string
  ) {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  }

  // =========================================================
  // RENDER COMMENT WITH MENTION
  // =========================================================

  function renderCommentText(
    text: string,
    mentions?: PurchaseCommentMention[]
  ) {
    if (
      !mentions ||
      mentions.length === 0
    ) {
      return text;
    }

    const mentionNames = mentions
      .map(
        (mention) =>
          mention.user?.fullname
      )
      .filter(
        (
          fullname
        ): fullname is string =>
          Boolean(
            fullname &&
              fullname.trim()
          )
      );

    if (
      mentionNames.length === 0
    ) {
      return text;
    }

    const uniqueNames = Array.from(
      new Set(mentionNames)
    );

    const escapedNames =
      uniqueNames
        .sort(
          (a, b) =>
            b.length - a.length
        )
        .map(escapeRegExp);

    if (
      escapedNames.length === 0
    ) {
      return text;
    }

    const regex =
      new RegExp(
        `(@(?:${escapedNames.join(
          "|"
        )}))`,
        "gi"
      );

    const parts =
      text.split(regex);

    return parts.map(
      (part, index) => {
        const normalized =
          part.toLowerCase();

        const isMention =
          uniqueNames.some(
            (name) =>
              normalized ===
              `@${name.toLowerCase()}`
          );

        if (!isMention) {
          return (
            <span
              key={`${part}-${index}`}
            >
              {part}
            </span>
          );
        }

        return (
          <span
            key={`${part}-${index}`}
            className="
              rounded-md
              bg-[#E9F5EF]
              px-1
              font-bold
              text-[#287258]
            "
          >
            {part}
          </span>
        );
      }
    );
  }

  // =========================================================
  // SELECTED MENTION PREVIEW
  // =========================================================

  const visibleSelectedMentions =
    selectedMentions.filter(
      (mention) =>
        comment.includes(
          mention.token
        )
    );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="
        relative
        overflow-hidden
        rounded-[26px]
        border
        border-[#D9E8E1]
        bg-white
        shadow-[0_18px_55px_rgba(24,53,45,0.075)]
      "
    >
      {/* PREMIUM TOP ACCENT */}
      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          h-[2px]
          bg-gradient-to-r
          from-transparent
          via-[#65A98D]
          to-transparent
          opacity-80
        "
      />

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-[#E4ECE8]
          bg-gradient-to-r
          from-[#FBFDFC]
          via-white
          to-[#F6FAF8]
          px-5
          py-4
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="
              relative
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              overflow-hidden
              rounded-[14px]
              border
              border-[#CDE4D8]
              bg-gradient-to-br
              from-[#F0F9F4]
              via-[#E4F3EC]
              to-[#D6EBE1]
              text-[#347960]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_7px_18px_rgba(42,105,79,0.08)]
            "
          >
            <div
              className="
                absolute
                -right-3
                -top-3
                h-8
                w-8
                rounded-full
                bg-[#75B79B]/20
                blur-md
              "
            />

            <MessageSquare
              size={19}
              strokeWidth={1.8}
              className="relative"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                className="
                  truncate
                  text-[14px]
                  font-black
                  tracking-[-0.015em]
                  text-[#18352D]
                "
              >
                Komentar PO
              </h2>

              <span
                className="
                  hidden
                  rounded-full
                  border
                  border-[#D4E6DD]
                  bg-[#F1F8F4]
                  px-2
                  py-0.5
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.12em]
                  text-[#4C806D]
                  sm:inline-flex
                "
              >
                Discussion
              </span>
            </div>

            <p
              className="
                mt-1
                text-[10px]
                font-medium
                leading-relaxed
                text-[#81928A]
              "
            >
              Catatan dan komunikasi terkait
              Purchase Order
            </p>
          </div>
        </div>

        {/* REFRESH */}

        <button
          type="button"
          onClick={() => {
            void loadComments();
          }}
          disabled={loading}
          title="Refresh komentar"
          aria-label="Refresh komentar"
          className="
            group
            relative
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            overflow-hidden
            rounded-[13px]
            border
            border-[#CFE3D9]
            bg-gradient-to-br
            from-[#F8FCFA]
            via-[#EFF8F3]
            to-[#E5F2EB]
            text-[#3E7965]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_rgba(39,91,70,0.07)]
            transition-all
            duration-200
            hover:-translate-y-0.5
            hover:border-[#AFCFBE]
            hover:from-[#F2FAF5]
            hover:to-[#DDEFE5]
            hover:text-[#28684F]
            hover:shadow-[0_10px_24px_rgba(39,91,70,0.12)]
            active:translate-y-0
            active:scale-[0.96]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            size={16}
            strokeWidth={1.8}
            className={`
              relative
              transition-transform
              duration-300
              group-hover:rotate-[-25deg]
              ${
                loading
                  ? "animate-spin"
                  : ""
              }
            `}
          />
        </button>
      </div>

      {/* =====================================================
          COMMENTS
      ===================================================== */}

      <div
        className="
          max-h-[440px]
          space-y-3
          overflow-y-auto
          bg-[#FCFDFC]
          p-5
        "
      >
        {loading ? (
          <div
            className="
              flex
              flex-col
              items-center
              justify-center
              rounded-2xl
              border
              border-[#E4ECE8]
              bg-white
              py-12
              shadow-[0_5px_20px_rgba(24,53,45,0.025)]
            "
          >
            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-[14px]
                border
                border-[#D6E8DF]
                bg-[#F0F8F4]
                text-[#4D846F]
              "
            >
              <RefreshCw
                size={18}
                className="animate-spin"
              />
            </div>

            <p
              className="
                mt-3
                text-[11px]
                font-bold
                text-[#53675E]
              "
            >
              Memuat komentar...
            </p>

            <p
              className="
                mt-1
                text-[9px]
                text-[#9AA9A3]
              "
            >
              Menyiapkan percakapan PO
            </p>
          </div>
        ) : comments.length === 0 ? (
          <div
            className="
              rounded-2xl
              border
              border-dashed
              border-[#D6E5DE]
              bg-gradient-to-br
              from-white
              to-[#F5FAF7]
              px-5
              py-10
              text-center
            "
          >
            <div
              className="
                mx-auto
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-[18px]
                border
                border-[#D9E9E1]
                bg-gradient-to-br
                from-[#F3FAF6]
                to-[#E7F3ED]
                text-[#62937F]
                shadow-[0_8px_20px_rgba(48,103,80,0.06)]
              "
            >
              <MessageSquare
                size={23}
                strokeWidth={1.6}
              />
            </div>

            <p
              className="
                mt-4
                text-[12px]
                font-black
                text-[#334D43]
              "
            >
              Belum ada komentar
            </p>

            <p
              className="
                mx-auto
                mt-1.5
                max-w-[280px]
                text-[9px]
                leading-relaxed
                text-[#899992]
              "
            >
              Belum ada komunikasi pada PO
              ini. Gunakan{" "}
              <span className="font-bold text-[#5E8C78]">
                @
              </span>{" "}
              untuk mention user.
            </p>
          </div>
        ) : (
          comments.map((item) => {
            /*
             * IMPORTANT:
             *
             * Ini hanya menentukan tampilan tombol.
             * Security DELETE tetap harus dicek backend.
             */

            const commentUserId =
              Number(item.user?.id);

            const userId =
              Number(currentUserId);

            const isOwnComment =
              currentUserId !== null &&
              Number.isInteger(commentUserId) &&
              commentUserId > 0 &&
              commentUserId === userId;

            const isDeleting =
              deletingCommentId === item.id;

            return (
              <div
                key={item.id}
                className="
                  group/comment
                  relative
                  overflow-hidden
                  rounded-[20px]
                  border
                  border-[#E0EAE5]
                  bg-white
                  p-4
                  shadow-[0_6px_20px_rgba(24,53,45,0.025)]
                  transition-all
                  duration-200
                  hover:-translate-y-[1px]
                  hover:border-[#C9DED4]
                  hover:shadow-[0_10px_28px_rgba(24,53,45,0.055)]
                "
              >
                {/* COMMENT TOP ACCENT */}

                <div
                  className="
                    absolute
                    inset-x-0
                    top-0
                    h-px
                    bg-gradient-to-r
                    from-transparent
                    via-[#D5E9DF]
                    to-transparent
                  "
                />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* AVATAR */}

                    <div
                      className="
                        relative
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-[13px]
                        border
                        border-[#CFE3D9]
                        bg-gradient-to-br
                        from-[#EFF8F3]
                        via-[#E4F2EB]
                        to-[#D8EBE2]
                        text-[12px]
                        font-black
                        text-[#39755F]
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]
                      "
                    >
                      <span className="relative">
                        {(
                          item.user?.fullname ||
                          "U"
                        )
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>

                    {/* USER */}

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p
                          className="
                            truncate
                            text-[12px]
                            font-black
                            tracking-[-0.01em]
                            text-[#19372E]
                          "
                        >
                          {item.user?.fullname ||
                            "User"}
                        </p>

                        {isOwnComment && (
                          <span
                            className="
                              shrink-0
                              rounded-full
                              border
                              border-[#CDE4D8]
                              bg-[#EDF7F2]
                              px-1.5
                              py-0.5
                              text-[7px]
                              font-black
                              uppercase
                              tracking-[0.08em]
                              text-[#39775F]
                            "
                          >
                            Anda
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="
                            rounded-full
                            bg-[#F3F7F5]
                            px-1.5
                            py-0.5
                            text-[8px]
                            font-bold
                            text-[#789087]
                          "
                        >
                          {item.user?.role ||
                            "-"}
                        </span>

                        <span className="h-1 w-1 rounded-full bg-[#C8D5CF]" />

                        <span
                          className="
                            text-[8px]
                            font-medium
                            text-[#A0ADA7]
                          "
                        >
                          {formatDate(
                            item.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      DELETE
                      HANYA KOMENTAR SENDIRI
                  ================================================= */}

                  {isOwnComment && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteComment(
                          item
                        );
                      }}
                      disabled={isDeleting}
                      title="Hapus komentar"
                      aria-label={`Hapus komentar dari ${
                        item.user?.fullname ||
                        "komentar ini"
                      }`}
                      className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-[10px]
                        border
                        border-[#E8D2D2]
                        bg-[#FFF8F8]
                        text-[#B85D5D]
                        opacity-100
                        shadow-[0_3px_10px_rgba(160,70,70,0.06)]
                        transition-all
                        duration-200
                        hover:-translate-y-0.5
                        hover:border-[#DDBABA]
                        hover:bg-[#FFF0F0]
                        hover:text-[#A94747]
                        hover:shadow-[0_7px_16px_rgba(160,70,70,0.11)]
                        active:translate-y-0
                        active:scale-95
                        disabled:cursor-wait
                        disabled:opacity-60
                      "
                    >
                      {isDeleting ? (
                        <RefreshCw
                          size={14}
                          strokeWidth={2}
                          className="animate-spin"
                        />
                      ) : (
                        <Trash2
                          size={14}
                          strokeWidth={1.9}
                        />
                      )}
                    </button>
                  )}
                </div>

                {/* MESSAGE */}

                <div
                  className="
                    mt-3
                    whitespace-pre-wrap
                    break-words
                    rounded-[13px]
                    bg-[#FAFCFB]
                    px-3.5
                    py-3
                    text-[12px]
                    leading-[1.7]
                    text-[#4C5E56]
                  "
                >
                  {renderCommentText(
                    item.comment,
                    item.mentions
                  )}
                </div>

                {/* MENTION CHIPS */}

                {item.mentions &&
                  item.mentions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.mentions.map(
                        (mention) => (
                          <span
                            key={mention.id}
                            className="
                              inline-flex
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              border-[#CBE2D7]
                              bg-gradient-to-r
                              from-[#EEF8F3]
                              to-[#E5F3EC]
                              px-2.5
                              py-1
                              text-[9px]
                              font-bold
                              text-[#39765F]
                            "
                          >
                            <AtSign
                              size={10}
                              strokeWidth={2}
                            />

                            {mention.user
                              ?.fullname ||
                              "User"}
                          </span>
                        )
                      )}
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================
          INPUT
      ===================================================== */}

      <form
        onSubmit={handleSubmit}
        className="
          relative
          border-t
          border-[#E2EBE7]
          bg-gradient-to-b
          from-[#F9FCFA]
          to-[#F4F9F6]
          p-4
        "
      >
        <div className="relative">
          {/* =================================================
              MENTION DROPDOWN
          ================================================= */}

          {mentionOpen && (
            <div
              ref={mentionBoxRef}
              className="
                absolute
                bottom-full
                left-0
                right-0
                z-[10020]
                mb-2
                overflow-hidden
                rounded-[20px]
                border
                border-[#D3E5DC]
                bg-white/95
                shadow-[0_24px_60px_rgba(24,53,45,0.16)]
                backdrop-blur-xl
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-[#E6EEEA]
                  bg-gradient-to-r
                  from-[#F7FBF9]
                  to-[#EFF7F3]
                  px-4
                  py-3
                "
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-[11px]
                      border
                      border-[#CFE5DA]
                      bg-[#EAF5EF]
                      text-[#3F7B64]
                    "
                  >
                    <AtSign
                      size={15}
                      strokeWidth={1.9}
                    />
                  </div>

                  <div>
                    <p
                      className="
                        text-[11px]
                        font-black
                        text-[#18352D]
                      "
                    >
                      Mention User
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[8px]
                        font-medium
                        text-[#879790]
                      "
                    >
                      Pilih user yang ingin
                      diberi mention
                    </p>
                  </div>
                </div>

                {mentionQuery && (
                  <span
                    className="
                      rounded-full
                      border
                      border-[#CFE5DA]
                      bg-[#EAF5EF]
                      px-2.5
                      py-1
                      text-[9px]
                      font-black
                      text-[#3B775F]
                    "
                  >
                    @{mentionQuery}
                  </span>
                )}
              </div>

              <div className="max-h-[280px] overflow-y-auto p-2">
                {loadingUsers ? (
                  <div
                    className="
                      flex
                      items-center
                      justify-center
                      gap-2
                      px-4
                      py-8
                      text-[10px]
                      font-semibold
                      text-[#8D9B95]
                    "
                  >
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                    Memuat user...
                  </div>
                ) : filteredMentionUsers.length ===
                  0 ? (
                  <div className="px-4 py-8 text-center">
                    <UserRound
                      size={22}
                      className="mx-auto mb-2 text-[#C5D0CB]"
                    />

                    <p
                      className="
                        text-[10px]
                        font-bold
                        text-[#687970]
                      "
                    >
                      User tidak ditemukan
                    </p>

                    <p
                      className="
                        mt-1
                        text-[8px]
                        text-[#9AA7A1]
                      "
                    >
                      Coba gunakan nama user
                      lain.
                    </p>
                  </div>
                ) : (
                  filteredMentionUsers.map(
                    (user, index) => {
                      const active =
                        index ===
                        activeMentionIndex;

                      return (
                        <button
                          key={user.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();

                            selectMention(
                              user
                            );
                          }}
                          className={`
                            flex
                            w-full
                            items-center
                            gap-3
                            rounded-[13px]
                            px-3
                            py-2.5
                            text-left
                            transition-all
                            duration-150
                            ${
                              active
                                ? "border border-[#D3E8DC] bg-gradient-to-r from-[#EDF8F2] to-[#E6F4EC] shadow-[0_4px_12px_rgba(47,113,82,0.06)]"
                                : "border border-transparent hover:bg-[#F5F9F7]"
                            }
                          `}
                        >
                          <div
                            className={`
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-center
                              justify-center
                              rounded-[11px]
                              text-[10px]
                              font-black
                              transition-all
                              ${
                                active
                                  ? "border border-[#BFDCCA] bg-gradient-to-br from-[#5B967D] to-[#39775F] text-white shadow-[0_5px_12px_rgba(51,112,82,0.16)]"
                                  : "border border-[#E0E8E4] bg-[#F3F6F4] text-[#75857D]"
                              }
                            `}
                          >
                            {user.fullname
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`
                                  truncate
                                  text-[11px]
                                  font-bold
                                  ${
                                    active
                                      ? "text-[#183C30]"
                                      : "text-[#4C5D55]"
                                  }
                                `}
                              >
                                {user.fullname}
                              </p>

                              {active && (
                                <Check
                                  size={13}
                                  strokeWidth={2}
                                  className="shrink-0 text-[#3B795F]"
                                />
                              )}
                            </div>

                            <p
                              className="
                                mt-0.5
                                truncate
                                text-[8px]
                                font-medium
                                text-[#909D97]
                              "
                            >
                              {user.role}
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )
                )}
              </div>

              {!loadingUsers &&
                filteredMentionUsers.length >
                  0 && (
                  <div
                    className="
                      border-t
                      border-[#E7EEEA]
                      bg-[#FAFCFB]
                      px-4
                      py-2.5
                    "
                  >
                    <p
                      className="
                        text-[8px]
                        font-medium
                        text-[#929F99]
                      "
                    >
                      <span className="font-black text-[#65756D]">
                        ↑ ↓
                      </span>{" "}
                      pilih
                      {" · "}
                      <span className="font-black text-[#65756D]">
                        Enter
                      </span>{" "}
                      gunakan
                      {" · "}
                      <span className="font-black text-[#65756D]">
                        Esc
                      </span>{" "}
                      tutup
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* =================================================
              TEXTAREA + SEND
          ================================================= */}

          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={comment}
                onChange={(e) =>
                  handleCommentChange(
                    e.target.value
                  )
                }
                onClick={
                  handleTextareaClick
                }
                onKeyUp={
                  handleTextareaKeyUp
                }
                onKeyDown={
                  handleMentionKeyDown
                }
                maxLength={2000}
                rows={2}
                placeholder="Tulis komentar... ketik @ untuk mention user"
                disabled={sending}
                className="
                  min-h-[76px]
                  w-full
                  resize-none
                  rounded-[16px]
                  border
                  border-[#D3E3DC]
                  bg-white
                  px-4
                  py-3
                  pb-7
                  text-[12px]
                  font-medium
                  leading-6
                  text-[#18352D]
                  outline-none
                  shadow-[inset_0_1px_2px_rgba(30,60,49,0.025)]
                  transition-all
                  placeholder:text-[#A0ADA7]
                  focus:border-[#5B967D]
                  focus:ring-4
                  focus:ring-[#4E8A72]/10
                  disabled:cursor-not-allowed
                  disabled:bg-[#F2F5F3]
                "
              />

              <div
                className="
                  pointer-events-none
                  absolute
                  bottom-2.5
                  left-4
                  flex
                  items-center
                  gap-1.5
                  text-[8px]
                  font-semibold
                  text-[#A3AEA9]
                "
              >
                <AtSign size={10} />
                Ketik @ untuk mention
              </div>
            </div>

            {/* SEND BUTTON */}

            <button
              type="submit"
              disabled={
                sending ||
                !comment.trim()
              }
              className="
                group
                relative
                inline-flex
                h-[76px]
                shrink-0
                items-center
                justify-center
                gap-2
                overflow-hidden
                rounded-[16px]
                border
                border-[#3C8066]
                bg-gradient-to-br
                from-[#5C9A80]
                via-[#4A896F]
                to-[#36745D]
                px-5
                text-[11px]
                font-black
                tracking-[0.01em]
                text-white
                shadow-[0_9px_24px_rgba(49,117,88,0.18),inset_0_1px_0_rgba(255,255,255,0.22)]
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:from-[#66A68A]
                hover:via-[#528F76]
                hover:to-[#3A795F]
                hover:shadow-[0_13px_30px_rgba(49,117,88,0.24)]
                active:translate-y-0
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:border-[#CBD8D2]
                disabled:bg-[#DCE4DF]
                disabled:text-[#89968F]
                disabled:shadow-none
              "
            >
              <span
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-gradient-to-br
                  from-white/20
                  via-transparent
                  to-transparent
                  opacity-0
                  transition-opacity
                  group-hover:opacity-100
                "
              />

              {sending ? (
                <>
                  <RefreshCw
                    size={16}
                    strokeWidth={2}
                    className="relative animate-spin"
                  />

                  <span className="relative">
                    Mengirim...
                  </span>
                </>
              ) : (
                <>
                  <Send
                    size={16}
                    strokeWidth={1.9}
                    className="
                      relative
                      transition-transform
                      duration-200
                      group-hover:translate-x-0.5
                      group-hover:-translate-y-0.5
                    "
                  />

                  <span className="relative">
                    Kirim
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* =================================================
            SELECTED MENTIONS
        ================================================= */}

        {visibleSelectedMentions.length >
          0 && (
          <div
            className="
              mt-3
              rounded-[15px]
              border
              border-[#D9E7E0]
              bg-white
              px-3
              py-2.5
              shadow-[0_4px_14px_rgba(24,53,45,0.025)]
            "
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.14em]
                  text-[#96A39D]
                "
              >
                Mention:
              </span>

              {visibleSelectedMentions.map(
                (mention) => (
                  <button
                    key={mention.id}
                    type="button"
                    onClick={() => {
                      const textarea =
                        textareaRef.current;

                      if (!textarea) {
                        return;
                      }

                      const token =
                        mention.token;

                      const index =
                        comment.indexOf(
                          token
                        );

                      if (index < 0) {
                        return;
                      }

                      const before =
                        comment.slice(
                          0,
                          index
                        );

                      const after =
                        comment.slice(
                          index +
                            token.length
                        );

                      const next =
                        `${before}${after}`
                          .replace(
                            / {2,}/g,
                            " "
                          )
                          .trimStart();

                      setComment(next);

                      setSelectedMentions(
                        (current) =>
                          current.filter(
                            (item) =>
                              item.id !==
                              mention.id
                          )
                      );

                      requestAnimationFrame(
                        () => {
                          textarea.focus();
                        }
                      );
                    }}
                    className="
                      group
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-full
                      border
                      border-[#CBE2D6]
                      bg-gradient-to-r
                      from-[#EEF8F3]
                      to-[#E5F3EC]
                      px-2.5
                      py-1
                      text-[9px]
                      font-bold
                      text-[#3C765F]
                      transition-all
                      hover:border-[#E5CACA]
                      hover:bg-[#FFF5F5]
                      hover:text-[#B35E5E]
                      active:scale-95
                    "
                    title="Hapus mention"
                  >
                    <AtSign
                      size={10}
                      strokeWidth={2}
                    />

                    {mention.fullname}

                    <X
                      size={10}
                      strokeWidth={2}
                      className="
                        opacity-50
                        transition-opacity
                        group-hover:opacity-100
                      "
                    />
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* FOOTER INFO */}

        <div
          className="
            mt-2.5
            flex
            items-center
            justify-between
            gap-3
            text-[8px]
            font-medium
            text-[#9AA6A0]
          "
        >
          <span>
            Mention akan dikirim bersama
            komentar.
          </span>

          <span
            className={`
              shrink-0
              font-bold
              ${
                comment.length > 1800
                  ? "text-[#B77955]"
                  : "text-[#9AA6A0]"
              }
            `}
          >
            {comment.length}/2000
          </span>
        </div>
      </form>
    </div>
  );
}