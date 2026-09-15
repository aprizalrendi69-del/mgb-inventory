"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  RefreshCw,
  Users,
} from "lucide-react";

type User = {
  id: number;
  fullname: string;
  username: string;
  role: string;
  outlet: string;
  lastSeen: string | null;
  online: boolean;
};

export default function OnlineUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    try {
      const res = await fetch("/api/user/online", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const json = await res.json();

      if (json.success) {
        setUsers(json.users || []);
      }
    } catch (error) {
      console.error("ONLINE USERS ERROR:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();

    const interval = setInterval(() => {
      loadUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const onlineCount = users.filter(
    (user) => user.online
  ).length;

  return (
    <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-800">
              User System
            </h2>

            <p className="text-xs text-slate-400">
              Status pengguna
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
            {onlineCount} Online
          </span>

          <button
            type="button"
            onClick={loadUsers}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Memuat user...
          </div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Tidak ada user
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 py-3"
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                  {user.fullname
                    ?.charAt(0)
                    ?.toUpperCase() || "U"}
                </div>

                <Circle
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                    user.online
                      ? "fill-emerald-500 text-emerald-500"
                      : "fill-slate-300 text-slate-300"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-700">
                  {user.fullname}
                </p>

                <p className="truncate text-[11px] text-slate-400">
                  @{user.username}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`text-[10px] font-bold ${
                    user.online
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  {user.online ? "ONLINE" : "OFFLINE"}
                </p>

                <p className="mt-0.5 text-[9px] text-slate-400">
                  {user.outlet}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}