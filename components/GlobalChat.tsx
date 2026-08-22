"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  Users,
  X,
} from "lucide-react";

type User = {
  id: number;
  username: string;
  fullname: string;
  role: string;
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
  } | null;
  lastReadAt?: string | null;
};

type CurrentUser = {
  id: number;
  username: string;
  fullname: string;
  role: string;
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

export default function GlobalChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(
    [],
  );

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

          await loadConversations(true);

          setSelectedConversationId(
            conversation.id,
          );

          setMessages([]);

          await loadMessages(
            conversation.id,
            false,
          );
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
    event: React.KeyboardEvent<HTMLInputElement>,
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
   * CLOSED
   * ============================================================
   */

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        aria-label="Buka chat"
        className="
          fixed
          bottom-4
          right-4
          z-[9999]
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-full
          bg-emerald-600
          text-white
          shadow-xl
          transition
          hover:bg-emerald-700
          hover:shadow-2xl
          active:scale-95
          sm:bottom-5
          sm:right-5
        "
      >
        <MessageCircle
          className="h-6 w-6"
          strokeWidth={2}
        />

        {totalUnread > 0 && (
          <span
            className="
              absolute
              -right-1
              -top-1
              flex
              h-6
              min-w-6
              items-center
              justify-center
              rounded-full
              border-2
              border-white
              bg-red-500
              px-1
              text-[11px]
              font-bold
              text-white
            "
          >
            {totalUnread > 99
              ? "99+"
              : totalUnread}
          </span>
        )}
      </button>
    );
  }

  /*
   * ============================================================
   * MINIMIZED
   * ============================================================
   */

  if (minimized) {
    return (
      <div
        className="
          fixed
          bottom-4
          right-4
          z-[9999]
          flex
          items-center
          gap-2
          sm:bottom-5
          sm:right-5
        "
      >
        <button
          type="button"
          onClick={() =>
            setMinimized(false)
          }
          className="
            flex
            h-12
            items-center
            gap-3
            rounded-full
            bg-white
            px-4
            shadow-xl
            ring-1
            ring-gray-200
            transition
            hover:bg-gray-50
          "
        >
          <span
            className="
              relative
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              bg-emerald-600
              text-white
            "
          >
            <MessageCircle className="h-4 w-4" />

            {totalUnread > 0 && (
              <span
                className="
                  absolute
                  -right-1
                  -top-1
                  flex
                  h-4
                  min-w-4
                  items-center
                  justify-center
                  rounded-full
                  bg-red-500
                  px-1
                  text-[8px]
                  font-bold
                  text-white
                "
              >
                {totalUnread > 9
                  ? "9+"
                  : totalUnread}
              </span>
            )}
          </span>

          <span className="text-sm font-semibold text-gray-800">
            Chat
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            bg-white
            text-gray-500
            shadow-lg
            ring-1
            ring-gray-200
            hover:bg-gray-50
            hover:text-gray-700
          "
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * CHAT WINDOW
   *
   * DESKTOP:
   *   width 390px
   *   height auto
   *
   * MOBILE:
   *   hampir full width
   *   max-height 68vh
   *   bottom 12px
   *
   * Jadi halaman ERP tetap terlihat.
   * ============================================================
   */

  return (
    <div
      className="
        fixed
        bottom-3
        left-3
        right-3
        z-[9999]
        flex
        max-h-[68vh]
        flex-col
        overflow-hidden
        rounded-2xl
        bg-white
        shadow-2xl
        ring-1
        ring-black/10

        sm:bottom-5
        sm:left-auto
        sm:right-5
        sm:w-[390px]
        sm:max-w-[calc(100vw-40px)]
        sm:max-h-[calc(100vh-40px)]
      "
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div
        className="
          flex
          h-14
          shrink-0
          items-center
          justify-between
          bg-emerald-600
          px-3
          text-white
          sm:h-16
          sm:px-4
        "
      >
        {selectedConversationId ? (
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedConversationId(
                  null,
                );
                setMessages([]);
                setMessageInput("");
              }}
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-full
                hover:bg-white/10
              "
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div
              className="
                relative
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-white/15
                text-xs
                font-bold
                sm:h-10
                sm:w-10
                sm:text-sm
              "
            >
              {getInitials(
                selectedUser?.fullname,
              )}

              {selectedUser?.online && (
                <span
                  className="
                    absolute
                    bottom-0
                    right-0
                    h-3
                    w-3
                    rounded-full
                    border-2
                    border-emerald-600
                    bg-green-400
                  "
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {selectedUser?.fullname ||
                  "Chat"}
              </div>

              <div className="truncate text-[10px] text-emerald-100 sm:text-[11px]">
                {selectedUser?.online
                  ? "Online"
                  : selectedUser?.outlet?.name ||
                    getRoleLabel(
                      selectedUser?.role,
                    )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                bg-white/15
                sm:h-10
                sm:w-10
              "
            >
              <MessageCircle className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-bold">
                MGB Chat
              </div>

              <div className="text-[10px] text-emerald-100 sm:text-[11px]">
                Komunikasi internal
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() =>
              setMinimized(true)
            }
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-full
              hover:bg-white/10
            "
            title="Minimize"
          >
            <Minus className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-full
              hover:bg-white/10
            "
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          className="
            shrink-0
            border-b
            border-red-100
            bg-red-50
            px-3
            py-2
            text-xs
            text-red-600
            sm:px-4
          "
        >
          {error}
        </div>
      )}

      {/* ======================================================
          CHAT DETAIL
      ====================================================== */}

      {selectedConversationId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* MESSAGES */}

          <div
            className="
              min-h-0
              flex-1
              overflow-y-auto
              bg-gray-50
              px-3
              py-3
              overscroll-contain
              sm:px-3
              sm:py-4
            "
          >
            {loadingMessages &&
              messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  Memuat pesan...
                </div>
              )}

            {!loadingMessages &&
              messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <div
                    className="
                      mb-3
                      flex
                      h-12
                      w-12
                      items-center
                      justify-center
                      rounded-full
                      bg-emerald-50
                      text-emerald-600
                      sm:h-14
                      sm:w-14
                    "
                  >
                    <MessageCircle className="h-6 w-6" />
                  </div>

                  <div className="text-sm font-semibold text-gray-700">
                    Belum ada pesan
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    Mulai percakapan dengan{" "}
                    {selectedUser?.fullname}
                  </div>
                </div>
              )}

            <div className="space-y-2">
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
                    <div
                      className={`flex max-w-[82%] flex-col ${
                        mine
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          mine
                            ? "rounded-br-md bg-emerald-600 text-white"
                            : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-100"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {message.message}
                        </div>
                      </div>

                      <div
                        className="
                          mt-1
                          flex
                          items-center
                          gap-1
                          px-1
                          text-[10px]
                          text-gray-400
                        "
                      >
                        <span>
                          {formatTime(
                            message.createdAt,
                          )}
                        </span>

                        {mine &&
                          (message.readAt ? (
                            <CheckCheck className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Check className="h-3 w-3" />
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
              border-gray-100
              bg-white
              p-2.5
              pb-[calc(0.625rem+env(safe-area-inset-bottom))]
              sm:p-3
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                bg-gray-100
                px-2
                py-2
              "
            >
              <input
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
                  text-sm
                  text-gray-800
                  outline-none
                  placeholder:text-gray-400
                "
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={
                  sending ||
                  !messageInput.trim()
                }
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-emerald-600
                  text-white
                  transition
                  hover:bg-emerald-700
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-1 px-1 text-[10px] text-gray-400">
              Enter untuk mengirim
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
              border-gray-100
              bg-white
              p-2.5
              sm:p-3
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                rounded-xl
                bg-gray-100
                px-3
                py-2
              "
            >
              <Search className="h-4 w-4 shrink-0 text-gray-400" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Cari user..."
                className="
                  min-w-0
                  flex-1
                  bg-transparent
                  text-sm
                  outline-none
                  placeholder:text-gray-400
                "
              />
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
            "
          >
            {/* CONVERSATIONS */}

            {conversations.length > 0 && (
              <div>
                <div
                  className="
                    px-4
                    pb-2
                    pt-3
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-gray-400
                  "
                >
                  Percakapan
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
                        className="
                          flex
                          w-full
                          items-center
                          gap-3
                          px-4
                          py-3
                          text-left
                          transition
                          hover:bg-gray-50
                          active:bg-gray-100
                        "
                      >
                        <div
                          className="
                            relative
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-emerald-100
                            text-sm
                            font-bold
                            text-emerald-700
                            sm:h-11
                            sm:w-11
                          "
                        >
                          {getInitials(
                            person.fullname,
                          )}

                          {person.online && (
                            <span
                              className="
                                absolute
                                bottom-0
                                right-0
                                h-3
                                w-3
                                rounded-full
                                border-2
                                border-white
                                bg-green-500
                              "
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm ${
                                unread
                                  ? "font-bold text-gray-900"
                                  : "font-semibold text-gray-700"
                              }`}
                            >
                              {
                                person.fullname
                              }
                            </span>

                            <span className="shrink-0 text-[10px] text-gray-400">
                              {formatConversationTime(
                                conversation
                                  .lastMessage
                                  ?.createdAt,
                              )}
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-xs ${
                                unread
                                  ? "font-semibold text-gray-700"
                                  : "text-gray-400"
                              }`}
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
                                  h-2.5
                                  w-2.5
                                  shrink-0
                                  rounded-full
                                  bg-emerald-600
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
                  gap-2
                  px-4
                  pb-2
                  pt-4
                  text-[11px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-gray-400
                "
              >
                <Users className="h-3.5 w-3.5" />

                Semua User
              </div>

              {loadingUsers &&
                users.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-gray-400">
                    Memuat user...
                  </div>
                )}

              {!loadingUsers &&
                filteredUsers.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <div className="text-sm font-semibold text-gray-500">
                      User tidak ditemukan
                    </div>

                    <div className="mt-1 text-xs text-gray-400">
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
                        flex
                        w-full
                        items-center
                        gap-3
                        px-4
                        py-3
                        text-left
                        transition
                        hover:bg-gray-50
                        active:bg-gray-100
                      "
                    >
                      <div
                        className="
                          relative
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-gray-100
                          text-xs
                          font-bold
                          text-gray-600
                        "
                      >
                        {getInitials(
                          user.fullname,
                        )}

                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                            user.online
                              ? "bg-green-500"
                              : "bg-gray-300"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-800">
                          {user.fullname}
                        </div>

                        <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-gray-400">
                          <span>
                            {getRoleLabel(
                              user.role,
                            )}
                          </span>

                          {user.outlet?.name && (
                            <>
                              <span>•</span>

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
                        className={`shrink-0 text-[10px] ${
                          user.online
                            ? "font-medium text-green-600"
                            : "text-gray-400"
                        }`}
                      >
                        {user.online
                          ? "Online"
                          : "Offline"}
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
              border-gray-100
              bg-gray-50
              px-4
              py-2
            "
          >
            <span className="text-[10px] text-gray-400">
              MGB ERP Internal Chat
            </span>

            <MoreHorizontal className="h-4 w-4 text-gray-300" />
          </div>
        </div>
      )}
    </div>
  );
}