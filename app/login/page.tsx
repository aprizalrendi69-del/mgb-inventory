"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function login() {
    if (loading) return;

    if (!username.trim()) {
      alert("Username wajib diisi");
      return;
    }

    if (!password.trim()) {
      alert("Password wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const json = await res.json();

      console.log("LOGIN RESPONSE :", json);

      if (!res.ok || !json.success) {
        alert(
          json.message ||
            "Username atau password salah"
        );

        return;
      }

      // REDIRECT BERDASARKAN ROLE
      if (json.user?.role === "OUTLET_ADMIN") {
        router.replace("/outlet");
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch (error) {
      console.error("LOGIN ERROR :", error);

      alert("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  function enter(
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Enter") {
      login();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8">

        <h1 className="text-3xl font-bold text-center mb-2">
          PT.MITRA GARAM BOGATAMA
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Silakan login untuk melanjutkan...
        </p>

        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
          onKeyDown={enter}
          className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          onKeyDown={enter}
          className="w-full border rounded-lg p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg p-3 font-semibold"
        >
          {loading ? "Sedang Login..." : "Login"}
        </button>

      </div>
    </div>
  );
}