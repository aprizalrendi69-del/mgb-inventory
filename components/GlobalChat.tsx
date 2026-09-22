"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  Check,
  CheckCheck,
  ChevronLeft,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

type User = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  photo?: string | null;
  outletId?: number | null;
  lastSeen?: string | null;
  online?: boolean;
  outlet?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  message: string;
  createdAt: string;
  readAt?: string | null;
  sender: {
    id: number;
    username: string;
    fullname: string;
    role: string;
    photo?: string | null;
    outletId?: number | null;
  };
};

type Conversation = {
  id: number;
  createdAt: string;
  updatedAt: string;
  participants: User[];
  lastMessage: {
    id: number;
    message: string;
    createdAt: string;
    readAt?: string | null;
    senderId: number;
    senderName: string;
    senderPhoto?: string | null;
  } | null;
  lastReadAt?: string | null;
};

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
  photo?: string | null;
  outletId?: number | null;
};

type UsersResponse = {
  success: boolean;
  currentUser: CurrentUser;
  users: User[];
};

type ConversationsResponse = {
  success: boolean;
  conversations: Conversation[];
};

type MessagesResponse = {
  success: boolean;
  messages: ChatMessage[];
};

const POLLING_INTERVAL = 3000;

function formatTime(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConversationTime(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return formatTime(dateString);
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getInitials(name?: string) {
  if (!name) return "?";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}

function getRoleLabel(role?: string) {
  switch (role) {
    case "ADMIN":
      return "Admin Pusat";

    case "MANAGER":
      return "Manager";

    case "PURCHASING":
      return "Purchasing";

    case "GUDANG":
      return "Gudang";

    case "OUTLET_ADMIN":
      return "Admin Outlet";

    default:
      return role || "";
  }
}

function getAvatarTone(id: number) {
  const tones = [
    "from-[#DDF4E9] to-[#BFE6D1] text-[#176447]",
    "from-[#E5F0FF] to-[#D0E4FF] text-[#315D92]",
    "from-[#F2E9FF] to-[#E4D5FF] text-[#68449A]",
    "from-[#FFF0DB] to-[#FFE0B6] text-[#9A6225]",
    "from-[#E7F4F4] to-[#CDE9E7] text-[#2D6F70]",
  ];

  return tones[id % tones.length];
}

/*
 * ============================================================
 * PREMIUM CHAT ANIMATIONS
 * ============================================================
 */

function GlobalChatStyles() {
  return (
    <style jsx global>{`
      @keyframes mgb-chat-shake {
        0%,
        100% {
          transform: translate3d(0, 0, 0) rotate(0deg);
        }

        8% {
          transform: translate3d(-1px, 0, 0) rotate(-2deg);
        }

        16% {
          transform: translate3d(2px, 0, 0) rotate(2deg);
        }

        24% {
          transform: translate3d(-2px, 0, 0) rotate(-2deg);
        }

        32% {
          transform: translate3d(2px, 0, 0) rotate(1.5deg);
        }

        40% {
          transform: translate3d(-1px, 0, 0) rotate(-1deg);
        }

        48% {
          transform: translate3d(1px, 0, 0) rotate(0.5deg);
        }

        56%,
        100% {
          transform: translate3d(0, 0, 0) rotate(0deg);
        }
      }

      @keyframes mgb-chat-ring {
        0% {
          transform: scale(0.9);
          opacity: 0.72;
        }

        70% {
          transform: scale(1.28);
          opacity: 0;
        }

        100% {
          transform: scale(1.28);
          opacity: 0;
        }
      }

      @keyframes mgb-chat-badge {
        0%,
        100% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.12);
        }
      }

      @keyframes mgb-chat-shine {
        0% {
          transform: translateX(-140%);
        }

        45%,
        100% {
          transform: translateX(140%);
        }
      }

      @keyframes mgb-chat-float {
        0%,
        100% {
          transform: translateY(0);
        }

        50% {
          transform: translateY(-2px);
        }
      }

      .mgb-chat-launcher-shake {
        animation: mgb-chat-shake 1.8s ease-in-out infinite;
        transform-origin: center;
      }

      .mgb-chat-unread-ring {
        animation: mgb-chat-ring 1.7s ease-out infinite;
      }

      .mgb-chat-unread-badge {
        animation: mgb-chat-badge 1.45s ease-in-out infinite;
      }

      .mgb-chat-shine {
        animation: mgb-chat-shine 4.5s ease-in-out infinite;
      }

      .mgb-chat-minimized-unread {
        animation: mgb-chat-float 1.8s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .mgb-chat-launcher-shake,
        .mgb-chat-unread-ring,
        .mgb-chat-unread-badge,
        .mgb-chat-shine,
        .mgb-chat-minimized-unread {
          animation: none !important;
        }
      }
    `}</style>
  );
}

/*
 * ============================================================
 * REUSABLE AVATAR
 * ============================================================
 */

function UserAvatar({
  id,
  fullname,
  photo,
  sizeClass = "h-10 w-10",
  radiusClass = "rounded-[13px]",
  textClass = "text-[10px]",
  imageClass = "object-cover",
  showRing = false,
  showShadow = true,
  onImageError,
}: {
  id: number;
  fullname?: string;
  photo?: string | null;
  sizeClass?: string;
  radiusClass?: string;
  textClass?: string;
  imageClass?: string;
  showRing?: boolean;
  showShadow?: boolean;
  onImageError?: () => void;
}) {
  const [imageError, setImageError] =
    useState(false);

  const hasPhoto =
    Boolean(photo?.trim()) && !imageError;

  return (
    <div
      className={`
        relative
        flex
        shrink-0
        items-center
        justify-center
        overflow-hidden
        ${sizeClass}
        ${radiusClass}
        ${
          hasPhoto
            ? "bg-[#E8EFEB]"
            : `bg-gradient-to-br ${getAvatarTone(id)}`
        }
        ${textClass}
        font-black
        ${
          showShadow
            ? "shadow-[0_5px_16px_rgba(30,65,53,0.09)]"
            : ""
        }
        ${
          showRing
            ? "ring-1 ring-white/25"
            : ""
        }
      `}
    >
      {hasPhoto ? (
        <img
          src={photo as string}
          alt={fullname || "User"}
          className={`
            absolute
            inset-0
            h-full
            w-full
            ${imageClass}
          `}
          loading="lazy"
          onError={() => {
            setImageError(true);
            onImageError?.();
          }}
        />
      ) : (
        <span className="relative z-10">
          {getInitials(fullname)}
        </span>
      )}

      <span
        className="
          pointer-events-none
          absolute
          inset-0
          rounded-[inherit]
          bg-gradient-to-br
          from-white/20
          via-transparent
          to-black/5
        "
      />
    </div>
  );
}

export default function GlobalChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<number | null>(null);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(false);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [messageInput, setMessageInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;

    return (
      conversations.find(
        (conversation) =>
          conversation.id ===
          selectedConversationId,
      ) ?? null
    );
  }, [
    conversations,
    selectedConversationId,
  ]);

  const selectedUser = useMemo(() => {
    return (
      selectedConversation?.participants?.[0] ??
      null
    );
  }, [selectedConversation]);

  const filteredUsers = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.fullname
          .toLowerCase()
          .includes(keyword) ||
        user.username
          .toLowerCase()
          .includes(keyword) ||
        user.role
          .toLowerCase()
          .includes(keyword) ||
        user.outlet?.name
          .toLowerCase()
          .includes(keyword)
      );
    });
  }, [users, search]);

  const totalUnread = useMemo(() => {
    if (!currentUser) return 0;

    let count = 0;

    for (const conversation of conversations) {
      const last = conversation.lastMessage;

      if (!last) continue;

      if (last.senderId === currentUser.id) {
        continue;
      }

      if (!last.readAt) {
        count++;
      }
    }

    return count;
  }, [conversations, currentUser]);

  const onlineCount = useMemo(() => {
    return users.filter(
      (user) => user.online,
    ).length;
  }, [users]);

  const scrollToBottom = useCallback(
    (
      behavior: ScrollBehavior = "smooth",
    ) => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior,
        });
      });
    },
    [],
  );

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);

      const response = await fetch(
        "/api/chat/users",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Gagal mengambil daftar user",
        );
      }

      const data =
        (await response.json()) as UsersResponse;

      setCurrentUser(data.currentUser);
      setUsers(data.users ?? []);
      setError("");
    } catch (err) {
      console.error(err);

      setError(
        "Gagal mengambil daftar user.",
      );
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadConversations = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoadingConversations(true);
        }

        const response = await fetch(
          "/api/chat/conversations",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Gagal mengambil percakapan",
          );
        }

        const data =
          (await response.json()) as ConversationsResponse;

        setConversations(
          data.conversations ?? [],
        );

        setError("");
      } catch (err) {
        console.error(err);

        if (!silent) {
          setError(
            "Gagal mengambil percakapan.",
          );
        }
      } finally {
        if (!silent) {
          setLoadingConversations(false);
        }
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async (
      conversationId: number,
      silent = false,
    ) => {
      try {
        if (!silent) {
          setLoadingMessages(true);
        }

        const response = await fetch(
          `/api/chat/messages?conversationId=${conversationId}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Gagal mengambil pesan",
          );
        }

        const data =
          (await response.json()) as MessagesResponse;

        setMessages(data.messages ?? []);

        if (!silent) {
          setTimeout(() => {
            scrollToBottom("auto");
          }, 50);
        }
      } catch (err) {
        console.error(err);

        if (!silent) {
          setError(
            "Gagal mengambil pesan.",
          );
        }
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [scrollToBottom],
  );

  const markAsRead = useCallback(
    async (conversationId: number) => {
      try {
        const response = await fetch(
          "/api/chat/read",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              conversationId,
            }),
          },
        );

        if (!response.ok) {
          console.warn(
            "Gagal menandai pesan sebagai dibaca",
          );
          return;
        }

        setConversations((prev) =>
          prev.map((conversation) => {
            if (
              conversation.id !==
              conversationId
            ) {
              return conversation;
            }

            if (!conversation.lastMessage) {
              return conversation;
            }

            if (
              currentUser &&
              conversation.lastMessage
                .senderId ===
                currentUser.id
            ) {
              return conversation;
            }

            return {
              ...conversation,
              lastMessage: {
                ...conversation.lastMessage,
                readAt:
                  new Date().toISOString(),
              },
            };
          }),
        );
      } catch (err) {
        console.error(
          "markAsRead error:",
          err,
        );
      }
    },
    [currentUser],
  );

  const openConversation =
    useCallback(
      async (conversationId: number) => {
        setSelectedConversationId(
          conversationId,
        );

        await loadMessages(
          conversationId,
          false,
        );

        await markAsRead(conversationId);

        setTimeout(() => {
          inputRef.current?.focus();
        }, 120);
      },
      [loadMessages, markAsRead],
    );

  const startConversation =
    useCallback(
      async (userId: number) => {
        try {
          setError("");

          const existing =
            conversations.find(
              (conversation) =>
                conversation.participants.some(
                  (participant) =>
                    participant.id ===
                    userId,
                ),
            );

          if (existing) {
            await openConversation(
              existing.id,
            );

            return;
          }

          const response = await fetch(
            "/api/chat/conversations",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                userId,
              }),
            },
          );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Gagal membuat percakapan",
            );
          }

          const conversation =
            data.conversation as Conversation;

          if (conversation) {
            setConversations((prev) => {
              const exists = prev.some(
                (item) =>
                  item.id ===
                  conversation.id,
              );

              if (exists) {
                return prev.map((item) =>
                  item.id ===
                  conversation.id
                    ? conversation
                    : item,
                );
              }

              return [
                conversation,
                ...prev,
              ];
            });
          }

          await loadConversations(true);

          setSelectedConversationId(
            conversation.id,
          );

          setMessages([]);

          await loadMessages(
            conversation.id,
            false,
          );

          setTimeout(() => {
            inputRef.current?.focus();
          }, 120);
        } catch (err) {
          console.error(err);

          setError(
            err instanceof Error
              ? err.message
              : "Gagal membuat percakapan.",
          );
        }
      },
      [
        conversations,
        loadConversations,
        loadMessages,
        openConversation,
      ],
    );

  const sendMessage = useCallback(
    async () => {
      const message =
        messageInput.trim();

      if (
        !message ||
        !selectedConversationId ||
        sending
      ) {
        return;
      }

      try {
        setSending(true);
        setError("");

        const response = await fetch(
          "/api/chat/messages",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              conversationId:
                selectedConversationId,
              message,
            }),
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Gagal mengirim pesan",
          );
        }

        const newMessage =
          data.message as ChatMessage;

        setMessages((prev) => [
          ...prev,
          newMessage,
        ]);

        setMessageInput("");

        await loadConversations(true);

        setTimeout(() => {
          scrollToBottom();
        }, 30);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengirim pesan.",
        );
      } finally {
        setSending(false);
      }
    },
    [
      messageInput,
      selectedConversationId,
      sending,
      loadConversations,
      scrollToBottom,
    ],
  );

  useEffect(() => {
    if (!open) return;

    loadUsers();
    loadConversations();
  }, [
    open,
    loadUsers,
    loadConversations,
  ]);

  useEffect(() => {
    if (!open) return;

    const interval =
      window.setInterval(() => {
        loadUsers();
        loadConversations(true);

        if (selectedConversationId) {
          loadMessages(
            selectedConversationId,
            true,
          );

          markAsRead(
            selectedConversationId,
          );
        }
      }, POLLING_INTERVAL);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    open,
    selectedConversationId,
    loadUsers,
    loadConversations,
    loadMessages,
    markAsRead,
  ]);

  useEffect(() => {
    if (!selectedConversationId) return;

    scrollToBottom("auto");
  }, [
    selectedConversationId,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!open) {
      setSelectedConversationId(null);
      setMessages([]);
      setMessageInput("");
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape" &&
        open
      ) {
        setOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  const handleMessageKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  };

  /*
   * ============================================================
   * CLOSED / FLOATING LAUNCHER
   * ============================================================
   */

  if (!open) {
    return (
      <>
        <GlobalChatStyles />

        <div
          className={`
            fixed
            bottom-5
            right-5
            z-[9999]
            sm:bottom-6
            sm:right-6
            ${
              totalUnread > 0
                ? "mgb-chat-launcher-shake"
                : ""
            }
          `}
        >
          {totalUnread > 0 && (
            <span
              className="
                mgb-chat-unread-ring
                pointer-events-none
                absolute
                inset-0
                rounded-[22px]
                border-2
                border-[#54D696]/70
              "
            />
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setMinimized(false);
            }}
            aria-label={
              totalUnread > 0
                ? `Buka chat, ${totalUnread} chat belum dibaca`
                : "Buka chat"
            }
            className="
              group
              relative
              flex
              h-[60px]
              w-[60px]
              items-center
              justify-center
              overflow-visible
              rounded-[21px]
              border
              border-white/25
              bg-gradient-to-br
              from-[#2B8A68]
              via-[#176B4F]
              to-[#0C4936]
              text-white
              shadow-[0_18px_45px_rgba(14,76,55,0.34),inset_0_1px_0_rgba(255,255,255,0.22)]
              transition-all
              duration-300
              hover:-translate-y-1
              hover:scale-[1.025]
              hover:shadow-[0_22px_52px_rgba(14,76,55,0.42),inset_0_1px_0_rgba(255,255,255,0.28)]
              active:translate-y-0
              active:scale-95
            "
          >
            <span
              className="
                pointer-events-none
                absolute
                inset-[1px]
                overflow-hidden
                rounded-[20px]
              "
            >
              <span
                className="
                  mgb-chat-shine
                  absolute
                  -inset-y-8
                  left-0
                  w-1/3
                  rotate-[18deg]
                  bg-gradient-to-r
                  from-transparent
                  via-white/20
                  to-transparent
                  blur-[1px]
                "
              />
            </span>

            <span
              className="
                pointer-events-none
                absolute
                inset-0
                rounded-[21px]
                bg-gradient-to-br
                from-white/16
                via-transparent
                to-black/10
              "
            />

            <span
              className="
                pointer-events-none
                absolute
                -right-0.5
                -top-0.5
                h-3.5
                w-3.5
                rounded-full
                border-2
                border-white
                bg-[#50D38C]
                shadow-[0_0_0_4px_rgba(80,211,140,0.16),0_2px_8px_rgba(20,96,65,0.20)]
              "
            />

            <MessageCircle
              className="
                relative
                z-10
                h-[24px]
                w-[24px]
                transition-transform
                duration-300
                group-hover:scale-110
              "
              strokeWidth={1.75}
            />

            {totalUnread > 0 && (
              <span
                className="
                  mgb-chat-unread-badge
                  absolute
                  -right-2.5
                  -top-2.5
                  z-20
                  flex
                  h-[25px]
                  min-w-[25px]
                  items-center
                  justify-center
                  rounded-full
                  border-2
                  border-white
                  bg-gradient-to-br
                  from-[#EA6262]
                  to-[#C83F49]
                  px-1
                  text-[9px]
                  font-black
                  text-white
                  shadow-[0_5px_15px_rgba(200,63,73,0.34)]
                "
              >
                {totalUnread > 99
                  ? "99+"
                  : totalUnread}
              </span>
            )}
          </button>
        </div>
      </>
    );
  }

  /*
   * ============================================================
   * MINIMIZED
   * ============================================================
   */

  if (minimized) {
    return (
      <>
        <GlobalChatStyles />

        <div
          className="
            fixed
            bottom-5
            right-5
            z-[9999]
            flex
            items-center
            gap-2
            sm:bottom-6
            sm:right-6
          "
        >
          <button
            type="button"
            onClick={() =>
              setMinimized(false)
            }
            className={`
              group
              flex
              h-[54px]
              items-center
              gap-3
              rounded-[19px]
              border
              border-[#D9E7E1]
              bg-white/95
              px-3
              pr-4
              shadow-[0_18px_46px_rgba(31,65,53,0.17),inset_0_1px_0_rgba(255,255,255,0.9)]
              backdrop-blur-2xl
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:border-[#C6DDD3]
              hover:bg-white
              hover:shadow-[0_22px_52px_rgba(31,65,53,0.21)]
              ${
                totalUnread > 0
                  ? "mgb-chat-minimized-unread"
                  : ""
              }
            `}
          >
            <span
              className="
                relative
                flex
                h-10
                w-10
                items-center
                justify-center
                overflow-hidden
                rounded-[13px]
                border
                border-white/20
                bg-gradient-to-br
                from-[#2A8765]
                to-[#12523C]
                text-white
                shadow-[0_7px_18px_rgba(25,104,76,0.24),inset_0_1px_0_rgba(255,255,255,0.18)]
              "
            >
              <span
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  bg-gradient-to-br
                  from-white/15
                  via-transparent
                  to-transparent
                "
              />

              <MessageCircle
                className="relative h-[18px] w-[18px]"
                strokeWidth={1.8}
              />

              {totalUnread > 0 && (
                <span
                  className="
                    mgb-chat-unread-badge
                    absolute
                    -right-1
                    -top-1
                    flex
                    h-[17px]
                    min-w-[17px]
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-white
                    bg-[#D94D4D]
                    px-1
                    text-[7px]
                    font-black
                    text-white
                  "
                >
                  {totalUnread > 9
                    ? "9+"
                    : totalUnread}
                </span>
              )}
            </span>

            <span className="flex flex-col items-start">
              <span className="flex items-center gap-1.5 text-[12px] font-black tracking-[-0.01em] text-[#1D332A]">
                MGB Chat

                {totalUnread > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D94D4D]" />
                )}
              </span>

              <span className="mt-0.5 text-[9px] font-medium text-[#8B9B94]">
                {totalUnread > 0
                  ? `${totalUnread} pesan belum dibaca`
                  : "Komunikasi internal"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup chat"
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-[13px]
              border
              border-[#DDE7E3]
              bg-white/95
              text-[#71817A]
              shadow-[0_10px_28px_rgba(31,65,53,0.12)]
              backdrop-blur-xl
              transition
              hover:border-[#CADAD4]
              hover:bg-[#F8FBFA]
              hover:text-[#34594B]
              active:scale-95
            "
          >
            <X
              className="h-4 w-4"
              strokeWidth={1.8}
            />
          </button>
        </div>
      </>
    );
  }

  /*
   * ============================================================
   * MAIN CHAT WINDOW
   * ============================================================
   */

  return (
    <>
      <GlobalChatStyles />

      <div
        className="
          fixed
          bottom-4
          left-3
          right-3
          z-[9999]
          flex
          max-h-[72vh]
          flex-col
          overflow-hidden
          rounded-[25px]
          border
          border-[#D7E7E0]
          bg-white/95
          shadow-[0_28px_80px_rgba(23,62,48,0.24),0_8px_28px_rgba(23,62,48,0.08)]
          backdrop-blur-2xl

          sm:bottom-6
          sm:left-auto
          sm:right-6
          sm:w-[410px]
          sm:max-w-[calc(100vw-48px)]
          sm:max-h-[calc(100vh-48px)]
        "
      >
        {/* ======================================================
            PREMIUM HEADER
        ====================================================== */}

        <div
          className="
            relative
            shrink-0
            overflow-hidden
            border-b
            border-[#255F4B]/30
            bg-gradient-to-br
            from-[#287C5D]
            via-[#185D46]
            to-[#0C4432]
            px-4
            py-3
            text-white
            shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]
            sm:px-5
            sm:py-3.5
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -right-12
              -top-16
              h-40
              w-40
              rounded-full
              bg-[#7FE0B1]/16
              blur-3xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              -bottom-20
              left-10
              h-36
              w-36
              rounded-full
              bg-white/6
              blur-3xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              inset-x-0
              top-0
              h-px
              bg-white/25
            "
          />

          <div className="relative flex items-center justify-between">
            {selectedConversationId ? (
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConversationId(
                      null,
                    );
                    setMessages([]);
                    setMessageInput("");
                    setSearch("");
                  }}
                  aria-label="Kembali"
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-[11px]
                    border
                    border-white/10
                    bg-white/8
                    text-white
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
                    transition
                    hover:bg-white/15
                    active:scale-95
                  "
                >
                  <ChevronLeft
                    className="h-[18px] w-[18px]"
                    strokeWidth={1.8}
                  />
                </button>

                <div className="relative shrink-0">
                  <UserAvatar
                    id={selectedUser?.id ?? 0}
                    fullname={
                      selectedUser?.fullname
                    }
                    photo={selectedUser?.photo}
                    sizeClass="h-10 w-10"
                    radiusClass="rounded-[13px]"
                    textClass="text-[11px]"
                    showRing
                    showShadow
                  />

                  <span
                    className={`
                      absolute
                      bottom-[-1px]
                      right-[-1px]
                      h-3
                      w-3
                      rounded-full
                      border-2
                      border-[#185D46]
                      shadow-[0_0_0_2px_rgba(255,255,255,0.06)]
                      ${
                        selectedUser?.online
                          ? "bg-[#50D38C]"
                          : "bg-[#91A09A]"
                      }
                    `}
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[13px] font-black tracking-[-0.01em]">
                    {selectedUser?.fullname ||
                      "Chat"}
                  </div>

                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <span
                      className={`
                        h-1.5
                        w-1.5
                        shrink-0
                        rounded-full
                        ${
                          selectedUser?.online
                            ? "bg-[#50D38C]"
                            : "bg-white/35"
                        }
                      `}
                    />

                    <span className="truncate text-[9px] font-medium text-emerald-100">
                      {selectedUser?.online
                        ? "Sedang online"
                        : selectedUser?.outlet
                            ?.name ||
                          getRoleLabel(
                            selectedUser?.role,
                          )}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="
                    relative
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[13px]
                    border
                    border-white/10
                    bg-white/10
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]
                  "
                >
                  <span
                    className="
                      absolute
                      inset-0
                      bg-gradient-to-br
                      from-white/12
                      via-transparent
                      to-transparent
                    "
                  />

                  <MessageCircle
                    className="relative h-[19px] w-[19px]"
                    strokeWidth={1.7}
                  />

                  <span
                    className="
                      absolute
                      bottom-1
                      right-1
                      h-1.5
                      w-1.5
                      rounded-full
                      bg-[#50D38C]
                      shadow-[0_0_0_3px_rgba(80,211,140,0.15)]
                    "
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-black tracking-[-0.02em]">
                      MGB Chat
                    </span>

                    <Sparkles
                      className="h-3 w-3 text-[#A9E4C7]"
                      strokeWidth={1.8}
                    />
                  </div>

                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-[9px] font-medium text-emerald-100">
                      Komunikasi internal
                    </span>

                    {onlineCount > 0 && (
                      <>
                        <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
                        <span className="text-[9px] font-semibold text-[#A9E4C7]">
                          {onlineCount} online
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setMinimized(true)
                }
                aria-label="Minimize"
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-[11px]
                  border
                  border-white/5
                  text-white/80
                  transition
                  hover:bg-white/10
                  hover:text-white
                  active:scale-95
                "
              >
                <Minus
                  className="h-[17px] w-[17px]"
                  strokeWidth={1.8}
                />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-[11px]
                  border
                  border-white/5
                  text-white/80
                  transition
                  hover:bg-white/10
                  hover:text-white
                  active:scale-95
                "
              >
                <X
                  className="h-[17px] w-[17px]"
                  strokeWidth={1.8}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div
            className="
              flex
              shrink-0
              items-center
              gap-2
              border-b
              border-[#F1D5D5]
              bg-gradient-to-r
              from-[#FFF8F8]
              to-[#FFFDFD]
              px-4
              py-2.5
              text-[10px]
              font-medium
              text-[#B65353]
            "
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D86666] shadow-[0_0_0_3px_rgba(216,102,102,0.10)]" />

            <span className="min-w-0 flex-1">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError("")}
              className="text-[#C47B7B] transition hover:text-[#A94D4D]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ======================================================
            DETAIL CHAT
        ====================================================== */}

        {selectedConversationId ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* MESSAGES */}

            <div
              className="
                relative
                min-h-0
                flex-1
                overflow-y-auto
                bg-[#F5F8F6]
                px-3
                py-4
                overscroll-contain

                [scrollbar-color:#C9D8D1_transparent]
                [scrollbar-width:thin]

                sm:px-4
                sm:py-5
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  opacity-[0.22]
                  [background-image:radial-gradient(#AFC7BC_0.6px,transparent_0.6px)]
                  [background-size:14px_14px]
                "
              />

              {loadingMessages &&
                messages.length === 0 && (
                  <div className="relative flex h-full flex-col items-center justify-center text-center">
                    <div
                      className="
                        relative
                        flex
                        h-12
                        w-12
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-[16px]
                        border
                        border-[#D8E8E0]
                        bg-white
                        text-[#31805F]
                        shadow-[0_10px_28px_rgba(35,91,70,0.09)]
                      "
                    >
                      <span className="absolute inset-0 bg-gradient-to-br from-[#EFFAF4] to-transparent" />

                      <MessageCircle
                        className="relative h-5 w-5 animate-pulse"
                        strokeWidth={1.7}
                      />
                    </div>

                    <span className="mt-3 text-[10px] font-semibold text-[#82948B]">
                      Memuat percakapan...
                    </span>
                  </div>
                )}

              {!loadingMessages &&
                messages.length === 0 && (
                  <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
                    <div
                      className="
                        relative
                        flex
                        h-14
                        w-14
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-[18px]
                        bg-gradient-to-br
                        from-[#E2F4EB]
                        to-[#CBE9DB]
                        text-[#267657]
                        shadow-[0_12px_32px_rgba(38,118,87,0.12)]
                      "
                    >
                      <span className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-transparent" />

                      <MessageCircle
                        className="relative h-6 w-6"
                        strokeWidth={1.6}
                      />
                    </div>

                    <div className="mt-4 text-[13px] font-black tracking-[-0.01em] text-[#30463D]">
                      Percakapan baru
                    </div>

                    <div className="mt-1.5 max-w-[240px] text-[10px] leading-5 text-[#8B9B94]">
                      Mulai komunikasi internal
                      dengan{" "}
                      <span className="font-bold text-[#64786F]">
                        {selectedUser?.fullname}
                      </span>
                    </div>
                  </div>
                )}

              <div className="relative space-y-3">
                {messages.map((message) => {
                  const mine =
                    currentUser?.id ===
                    message.senderId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        mine
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {!mine && (
                        <div className="mr-2 mt-0.5 shrink-0">
                          <UserAvatar
                            id={
                              message.senderId
                            }
                            fullname={
                              message.sender
                                ?.fullname
                            }
                            photo={
                              message.sender
                                ?.photo
                            }
                            sizeClass="h-7 w-7"
                            radiusClass="rounded-[9px]"
                            textClass="text-[8px]"
                            showShadow={false}
                          />
                        </div>
                      )}

                      <div
                        className={`flex max-w-[79%] flex-col ${
                          mine
                            ? "items-end"
                            : "items-start"
                        }`}
                      >
                        {!mine && (
                          <span className="mb-1 ml-1 text-[9px] font-bold text-[#7D9087]">
                            {
                              message.sender
                                ?.fullname
                            }
                          </span>
                        )}

                        <div
                          className={`
                            rounded-[17px]
                            px-3.5
                            py-2.5
                            text-[12px]
                            leading-[1.55]
                            shadow-[0_4px_14px_rgba(31,65,53,0.06)]
                            ${
                              mine
                                ? "rounded-br-[6px] border border-[#2A825F] bg-gradient-to-br from-[#2A805E] via-[#217451] to-[#176348] text-white shadow-[0_7px_18px_rgba(31,112,82,0.17)]"
                                : "rounded-bl-[6px] border border-[#E1EBE5] bg-white text-[#33473F] shadow-[0_4px_14px_rgba(31,65,53,0.045)]"
                            }
                          `}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {message.message}
                          </div>
                        </div>

                        <div
                          className={`
                            mt-1
                            flex
                            items-center
                            gap-1
                            px-1
                            text-[8px]
                            font-medium
                            ${
                              mine
                                ? "text-[#829A90]"
                                : "text-[#9AA8A2]"
                            }
                          `}
                        >
                          <span>
                            {formatTime(
                              message.createdAt,
                            )}
                          </span>

                          {mine &&
                            (message.readAt ? (
                              <CheckCheck
                                className="h-3 w-3 text-[#3DAA7B]"
                                strokeWidth={2}
                              />
                            ) : (
                              <Check
                                className="h-3 w-3 text-[#9AA9A2]"
                                strokeWidth={2}
                              />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}

            <div
              className="
                shrink-0
                border-t
                border-[#E2EBE6]
                bg-white
                p-3
                pb-[calc(0.75rem+env(safe-area-inset-bottom))]
                shadow-[0_-6px_20px_rgba(25,62,48,0.025)]
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-[16px]
                  border
                  border-[#DDE8E3]
                  bg-[#F7F9F8]
                  px-2
                  py-2
                  shadow-[inset_0_1px_2px_rgba(30,70,55,0.025)]
                  transition-all
                  focus-within:border-[#A9CCBC]
                  focus-within:bg-white
                  focus-within:shadow-[0_0_0_3px_rgba(48,128,95,0.06),0_5px_18px_rgba(31,90,67,0.04)]
                "
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(event) =>
                    setMessageInput(
                      event.target.value,
                    )
                  }
                  onKeyDown={
                    handleMessageKeyDown
                  }
                  placeholder="Tulis pesan..."
                  maxLength={5000}
                  disabled={sending}
                  className="
                    min-w-0
                    flex-1
                    bg-transparent
                    px-2
                    text-[12px]
                    font-medium
                    text-[#30463D]
                    outline-none
                    placeholder:text-[#A3AEA9]
                  "
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={
                    sending ||
                    !messageInput.trim()
                  }
                  aria-label="Kirim pesan"
                  className="
                    group
                    relative
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-[11px]
                    bg-gradient-to-br
                    from-[#2B815F]
                    to-[#176348]
                    text-white
                    shadow-[0_6px_16px_rgba(30,112,81,0.22),inset_0_1px_0_rgba(255,255,255,0.16)]
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    hover:shadow-[0_8px_20px_rgba(30,112,81,0.27)]
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                    disabled:hover:translate-y-0
                    active:scale-95
                  "
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />

                  <Send
                    className={`
                      relative
                      h-3.5
                      w-3.5
                      transition-transform
                      ${
                        sending
                          ? "animate-pulse"
                          : "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      }
                    `}
                    strokeWidth={1.8}
                  />
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-[8px] font-medium text-[#9AA8A2]">
                  Enter untuk mengirim
                </span>

                <span className="text-[8px] font-medium text-[#B0BBB6]">
                  {messageInput.length > 0
                    ? `${messageInput.length}/5000`
                    : "Internal"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* ==================================================
                SEARCH
            ================================================== */}

            <div
              className="
                shrink-0
                border-b
                border-[#E7EEE9]
                bg-white
                px-3
                py-3
                shadow-[0_3px_12px_rgba(31,65,53,0.025)]
                sm:px-4
              "
            >
              <div
                className="
                  group
                  flex
                  items-center
                  gap-2.5
                  rounded-[15px]
                  border
                  border-[#E0EAE5]
                  bg-[#F7F9F8]
                  px-3
                  py-2.5
                  transition-all
                  focus-within:border-[#B8D5C8]
                  focus-within:bg-white
                  focus-within:shadow-[0_0_0_3px_rgba(48,128,95,0.055),0_5px_18px_rgba(31,90,67,0.04)]
                "
              >
                <Search
                  className="
                    h-4
                    w-4
                    shrink-0
                    text-[#93A39C]
                    transition
                    group-focus-within:text-[#388163]
                  "
                  strokeWidth={1.8}
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Cari nama, role, outlet..."
                  className="
                    min-w-0
                    flex-1
                    bg-transparent
                    text-[11px]
                    font-medium
                    text-[#34483F]
                    outline-none
                    placeholder:text-[#A2ADA8]
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="
                      flex
                      h-5
                      w-5
                      items-center
                      justify-center
                      rounded-full
                      bg-[#E5ECE8]
                      text-[#71827A]
                      transition
                      hover:bg-[#D9E4DF]
                      active:scale-95
                    "
                  >
                    <X
                      className="h-3 w-3"
                      strokeWidth={2}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* ==================================================
                BODY
            ================================================== */}

            <div
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
                bg-white
                [scrollbar-color:#C9D8D1_transparent]
                [scrollbar-width:thin]
              "
            >
              {/* CONVERSATIONS */}

              {conversations.length > 0 && (
                <div className="pb-1">
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      px-4
                      pb-2
                      pt-3.5
                    "
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="
                          h-1.5
                          w-1.5
                          rounded-full
                          bg-[#3DAA7B]
                          shadow-[0_0_0_3px_rgba(61,170,123,0.09)]
                        "
                      />

                      <span
                        className="
                          text-[9px]
                          font-black
                          uppercase
                          tracking-[0.16em]
                          text-[#82938B]
                        "
                      >
                        Percakapan
                      </span>
                    </div>

                    <span className="rounded-full bg-[#F4F7F5] px-2 py-1 text-[8px] font-semibold text-[#9AA6A0]">
                      {conversations.length} chat
                    </span>
                  </div>

                  {conversations.map(
                    (conversation) => {
                      const person =
                        conversation
                          .participants?.[0];

                      if (!person) {
                        return null;
                      }

                      const unread =
                        Boolean(
                          conversation
                            .lastMessage &&
                            conversation
                              .lastMessage
                              .senderId !==
                              currentUser?.id &&
                            !conversation
                              .lastMessage
                              .readAt,
                        );

                      return (
                        <button
                          key={
                            conversation.id
                          }
                          type="button"
                          onClick={() =>
                            openConversation(
                              conversation.id,
                            )
                          }
                          className={`
                            group
                            flex
                            w-full
                            items-center
                            gap-3
                            border-b
                            border-[#F0F3F1]
                            px-4
                            py-3
                            text-left
                            transition-all
                            hover:bg-[#F7FAF8]
                            active:bg-[#F1F6F3]
                            ${
                              unread
                                ? "bg-[#FCFEFD]"
                                : ""
                            }
                          `}
                        >
                          <div className="relative shrink-0">
                            <UserAvatar
                              id={person.id}
                              fullname={
                                person.fullname
                              }
                              photo={
                                person.photo
                              }
                              sizeClass="h-10 w-10"
                              radiusClass="rounded-[13px]"
                              textClass="text-[10px]"
                              showShadow
                            />

                            <span
                              className={`
                                absolute
                                bottom-[-1px]
                                right-[-1px]
                                h-2.5
                                w-2.5
                                rounded-full
                                border-2
                                border-white
                                ${
                                  person.online
                                    ? "bg-[#4FC48A]"
                                    : "bg-[#B7C1BC]"
                                }
                              `}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`
                                  truncate
                                  text-[11px]
                                  tracking-[-0.005em]
                                  ${
                                    unread
                                      ? "font-black text-[#263C33]"
                                      : "font-bold text-[#41534B]"
                                  }
                                `}
                              >
                                {
                                  person.fullname
                                }
                              </span>

                              <span
                                className={`
                                  shrink-0
                                  text-[8px]
                                  font-medium
                                  ${
                                    unread
                                      ? "text-[#3D886B]"
                                      : "text-[#A1ACA7]"
                                  }
                                `}
                              >
                                {formatConversationTime(
                                  conversation
                                    .lastMessage
                                    ?.createdAt,
                                )}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span
                                className={`
                                  truncate
                                  text-[9px]
                                  leading-4
                                  ${
                                    unread
                                      ? "font-bold text-[#65766E]"
                                      : "font-medium text-[#9AA59F]"
                                  }
                                `}
                              >
                                {conversation
                                  .lastMessage
                                  ?.senderId ===
                                currentUser?.id
                                  ? "Anda: "
                                  : ""}

                                {conversation
                                  .lastMessage
                                  ?.message ||
                                  "Belum ada pesan"}
                              </span>

                              {unread && (
                                <span
                                  className="
                                    mgb-chat-unread-badge
                                    h-2
                                    w-2
                                    shrink-0
                                    rounded-full
                                    bg-[#35A975]
                                    shadow-[0_0_0_3px_rgba(53,169,117,0.10)]
                                  "
                                />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

              {/* USERS */}

              <div>
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    px-4
                    pb-2
                    pt-4
                  "
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="
                        flex
                        h-6
                        w-6
                        items-center
                        justify-center
                        rounded-[8px]
                        border
                        border-[#DCEDE5]
                        bg-gradient-to-br
                        from-[#F0FAF5]
                        to-[#E6F4ED]
                        text-[#438269]
                      "
                    >
                      <Users
                        className="h-3 w-3"
                        strokeWidth={1.8}
                      />
                    </div>

                    <span
                      className="
                        text-[9px]
                        font-black
                        uppercase
                        tracking-[0.16em]
                        text-[#82938B]
                      "
                    >
                      Semua User
                    </span>
                  </div>

                  {onlineCount > 0 && (
                    <span
                      className="
                        flex
                        items-center
                        gap-1
                        rounded-full
                        border
                        border-[#DCEFE5]
                        bg-[#EDF8F2]
                        px-2
                        py-1
                        text-[8px]
                        font-bold
                        text-[#3B896A]
                      "
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4FC48A] shadow-[0_0_0_2px_rgba(79,196,138,0.12)]" />
                      {onlineCount} online
                    </span>
                  )}
                </div>

                {loadingUsers &&
                  users.length === 0 && (
                    <div className="space-y-1 px-4 py-4">
                      {[1, 2, 3].map(
                        (item) => (
                          <div
                            key={item}
                            className="
                              flex
                              items-center
                              gap-3
                              rounded-[13px]
                              px-1
                              py-2
                            "
                          >
                            <div className="h-10 w-10 animate-pulse rounded-[13px] bg-[#EDF2EF]" />

                            <div className="flex-1 space-y-2">
                              <div className="h-2.5 w-28 animate-pulse rounded-full bg-[#EDF2EF]" />
                              <div className="h-2 w-20 animate-pulse rounded-full bg-[#F1F4F2]" />
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                {!loadingUsers &&
                  filteredUsers.length === 0 && (
                    <div className="px-5 py-10 text-center">
                      <div
                        className="
                          mx-auto
                          flex
                          h-12
                          w-12
                          items-center
                          justify-center
                          rounded-[15px]
                          border
                          border-[#E7ECE9]
                          bg-gradient-to-br
                          from-[#F7F9F8]
                          to-[#EEF3F0]
                          text-[#A1ADA7]
                          shadow-[0_7px_20px_rgba(31,65,53,0.04)]
                        "
                      >
                        <Search
                          className="h-5 w-5"
                          strokeWidth={1.7}
                        />
                      </div>

                      <div className="mt-3 text-[11px] font-bold text-[#667870]">
                        User tidak ditemukan
                      </div>

                      <div className="mt-1 text-[9px] leading-4 text-[#A0AAA5]">
                        Coba gunakan kata
                        pencarian lain.
                      </div>
                    </div>
                  )}

                {filteredUsers.map(
                  (user) => {
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() =>
                          startConversation(
                            user.id,
                          )
                        }
                        className="
                          group
                          flex
                          w-full
                          items-center
                          gap-3
                          border-b
                          border-[#F2F5F3]
                          px-4
                          py-3
                          text-left
                          transition-all
                          hover:bg-[#F8FAF9]
                          active:bg-[#F1F5F3]
                        "
                      >
                        <div className="relative shrink-0">
                          <UserAvatar
                            id={user.id}
                            fullname={
                              user.fullname
                            }
                            photo={user.photo}
                            sizeClass="h-10 w-10"
                            radiusClass="rounded-[13px]"
                            textClass="text-[10px]"
                            showShadow
                          />

                          <span
                            className={`
                              absolute
                              bottom-[-1px]
                              right-[-1px]
                              h-2.5
                              w-2.5
                              rounded-full
                              border-2
                              border-white
                              ${
                                user.online
                                  ? "bg-[#4FC48A]"
                                  : "bg-[#B9C2BD]"
                              }
                            `}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-[11px] font-bold text-[#33483F]">
                              {user.fullname}
                            </div>
                          </div>

                          <div className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-[8px] font-medium text-[#98A49F]">
                            <span className="truncate">
                              {getRoleLabel(
                                user.role,
                              )}
                            </span>

                            {user.outlet?.name && (
                              <>
                                <span className="text-[#C0C9C5]">
                                  •
                                </span>

                                <span className="truncate">
                                  {
                                    user
                                      .outlet
                                      .name
                                  }
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div
                          className={`
                            shrink-0
                            rounded-full
                            border
                            px-2
                            py-1
                            text-[7px]
                            font-bold
                            ${
                              user.online
                                ? "border-[#DCEFE5] bg-[#EDF8F2] text-[#3B896A]"
                                : "border-[#E7EBE9] bg-[#F5F7F6] text-[#A1ABA6]"
                            }
                          `}
                        >
                          {user.online
                            ? "ONLINE"
                            : "OFFLINE"}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-t
                border-[#E6ECE9]
                bg-gradient-to-r
                from-[#F9FBFA]
                to-[#F5F8F6]
                px-4
                py-2.5
              "
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className="h-3 w-3 text-[#7A9A8B]"
                  strokeWidth={1.7}
                />

                <span className="text-[8px] font-semibold tracking-[0.03em] text-[#9AA6A0]">
                  MGB ERP Internal Chat
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4FC48A] shadow-[0_0_0_2px_rgba(79,196,138,0.10)]" />

                <span className="text-[8px] font-semibold text-[#82938B]">
                  Secure
                </span>

                <MoreHorizontal
                  className="ml-1 h-3.5 w-3.5 text-[#C0C9C5]"
                  strokeWidth={1.7}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}