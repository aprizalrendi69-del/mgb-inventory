"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  RefreshCw,
  Circle,
  Pencil,
  X,
  Save,
  Building2,
  CheckCircle2,
  UserRound,
  Activity,
  LockKeyhole,
  ChevronDown,
  Camera,
  Trash2,
  ImagePlus,
} from "lucide-react";

type Outlet = {
  id: number;
  name: string;
};

type User = {
  id: number;
  username: string;
  fullname: string;
  photo?: string | null;
  role: string;
  active: boolean;
  outletId?: number | null;
  outlet?: Outlet | null;
  lastSeen?: string | null;
  online?: boolean;
};

type FormState = {
  username: string;
  fullname: string;
  password: string;
  photo: string;
  role: string;
  outletId: string;
  active: boolean;
};

const initialForm: FormState = {
  username: "",
  fullname: "",
  password: "",
  photo: "",
  role: "ADMIN",
  outletId: "",
  active: true,
};

function isOutletRole(role: string) {
  return (
    role === "OUTLET_ADMIN" ||
    role === "KASIR"
  );
}

export default function UserPage() {
  const [data, setData] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);
  const [onlineLoading, setOnlineLoading] =
    useState(false);

  const [search, setSearch] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  const [editingUserId, setEditingUserId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<FormState>(initialForm);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  // =========================================================
  // LOAD USER
  // =========================================================

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/user", {
        cache: "no-store",
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data ?? []);
      } else {
        alert(
          json.message ??
            "Gagal mengambil data user"
        );
      }
    } catch (error) {
      console.error(
        "Load user error:",
        error
      );

      alert("Gagal mengambil data user");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD ONLINE STATUS
  // =========================================================

  async function loadOnlineStatus() {
    try {
      setOnlineLoading(true);

      const res = await fetch(
        "/api/user/online",
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Gagal mengambil status online"
        );
      }

      const json = await res.json();

      if (!json.success) {
        return;
      }

      const onlineUsers =
        json.users ?? [];

      setData((currentUsers) =>
        currentUsers.map((user) => {
          const onlineUser =
            onlineUsers.find(
              (item: any) =>
                item.id === user.id
            );

          if (!onlineUser) {
            return {
              ...user,
              online: false,
              lastSeen: null,
            };
          }

          return {
            ...user,
            online: Boolean(
              onlineUser.online
            ),
            lastSeen:
              onlineUser.lastSeen ??
              null,
          };
        })
      );
    } catch (error) {
      console.error(
        "Load online status error:",
        error
      );
    } finally {
      setOnlineLoading(false);
    }
  }

  // =========================================================
  // LOAD OUTLET
  // =========================================================

  async function loadOutlets() {
    try {
      const res = await fetch(
        "/api/outlet",
        {
          cache: "no-store",
        }
      );

      const json = await res.json();

      if (json.success) {
        setOutlets(json.data ?? []);
      } else {
        console.error(json.message);
      }
    } catch (error) {
      console.error(
        "Load outlet error:",
        error
      );
    }
  }

  // =========================================================
  // LOAD ALL
  // =========================================================

  async function loadAll() {
    await Promise.all([
      load(),
      loadOutlets(),
    ]);
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadAll();
  }, []);

  // =========================================================
  // ONLINE REFRESH
  // =========================================================

  useEffect(() => {
    loadOnlineStatus();

    const interval = setInterval(() => {
      loadOnlineStatus();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // =========================================================
  // RESET FORM
  // =========================================================

  function resetForm() {
    setForm({
      ...initialForm,
    });

    setEditingUserId(null);
    setShowPassword(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // =========================================================
  // MULAI EDIT
  // =========================================================

  function mulaiEdit(user: User) {
    setEditingUserId(user.id);

    setForm({
      username: user.username ?? "",
      fullname: user.fullname ?? "",
      password: "",
      photo: user.photo ?? "",
      role: user.role ?? "ADMIN",
      outletId: user.outletId
        ? String(user.outletId)
        : "",
      active: user.active,
    });

    setShowPassword(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =========================================================
  // BATAL EDIT
  // =========================================================

  function batalEdit() {
    if (
      saving ||
      uploadingPhoto
    ) {
      return;
    }

    resetForm();
  }

  // =========================================================
  // CHANGE ROLE
  // =========================================================

  function handleRoleChange(
    role: string
  ) {
    setForm((current) => ({
      ...current,
      role,
      outletId: isOutletRole(role)
        ? current.outletId
        : "",
    }));
  }

  // =========================================================
  // UPLOAD FOTO PROFILE
  // =========================================================

  async function handlePhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    event.target.value = "";

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      alert(
        "Format foto harus JPG, PNG, atau WEBP."
      );
      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "Ukuran foto maksimal 5 MB."
      );
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const res = await fetch(
        "/api/upload/profile",
        {
          method: "POST",
          body: formData,
        }
      );

      const json =
        await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.message ??
            "Gagal mengupload foto"
        );
      }

      const photoUrl =
        json.photo ??
        json.url;

      if (!photoUrl) {
        throw new Error(
          "URL foto tidak ditemukan."
        );
      }

      setForm((current) => ({
        ...current,
        photo: photoUrl,
      }));
    } catch (error) {
      console.error(
        "Upload profile photo error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengupload foto profil."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  // =========================================================
  // HAPUS FOTO PROFILE
  // =========================================================

  function hapusFoto() {
    if (
      saving ||
      uploadingPhoto
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      photo: "",
    }));
  }

  // =========================================================
  // BUKA FILE PICKER
  // =========================================================

  function bukaFilePicker() {
    if (
      saving ||
      uploadingPhoto
    ) {
      return;
    }

    fileInputRef.current?.click();
  }

  // =========================================================
  // SIMPAN / UPDATE USER
  // =========================================================

  async function simpan() {
    if (!form.username.trim()) {
      alert("Username wajib diisi");
      return;
    }

    if (!form.fullname.trim()) {
      alert("Nama wajib diisi");
      return;
    }

    if (
      editingUserId === null &&
      !form.password.trim()
    ) {
      alert("Password wajib diisi");
      return;
    }

    if (
      form.password.trim() &&
      form.password.length < 6
    ) {
      alert(
        "Password minimal 6 karakter"
      );
      return;
    }

    // KASIR dan OUTLET_ADMIN wajib memiliki outlet
    if (
      isOutletRole(form.role) &&
      !form.outletId
    ) {
      alert(
        form.role === "KASIR"
          ? "Outlet wajib dipilih untuk KASIR"
          : "Outlet wajib dipilih untuk OUTLET ADMIN"
      );
      return;
    }

    if (uploadingPhoto) {
      alert(
        "Tunggu sampai foto selesai diupload."
      );
      return;
    }

    try {
      setSaving(true);

      const isEdit =
        editingUserId !== null;

      const body = {
        ...(isEdit
          ? {
              id: editingUserId,
            }
          : {}),
        username:
          form.username.trim(),
        fullname:
          form.fullname.trim(),
        password: form.password,
        photo:
          form.photo.trim() || null,
        role: form.role,

        // Outlet hanya dikirim untuk role
        // yang memang terikat ke outlet.
        outletId: isOutletRole(
          form.role
        )
          ? Number(
              form.outletId
            )
          : null,

        active: form.active,
      };

      const res = await fetch(
        "/api/user",
        {
          method: isEdit
            ? "PUT"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            body
          ),
        }
      );

      const json =
        await res.json();

      if (json.success) {
        alert(
          isEdit
            ? "User berhasil diperbarui"
            : "User berhasil dibuat"
        );

        resetForm();

        await load();
        await loadOnlineStatus();
      } else {
        alert(
          json.message ??
            "Gagal menyimpan user"
        );
      }
    } catch (error) {
      console.error(
        "Simpan user error:",
        error
      );

      alert(
        "Terjadi kesalahan saat menyimpan user"
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredUsers =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      if (!keyword) {
        return data;
      }

      return data.filter(
        (user) => {
          return (
            user.username
              ?.toLowerCase()
              .includes(keyword) ||
            user.fullname
              ?.toLowerCase()
              .includes(keyword) ||
            user.role
              ?.toLowerCase()
              .includes(keyword) ||
            user.outlet?.name
              ?.toLowerCase()
              .includes(keyword)
          );
        }
      );
    }, [data, search]);

  // =========================================================
  // STATISTICS
  // =========================================================

  const onlineCount =
    useMemo(() => {
      return data.filter(
        (user) => user.online
      ).length;
    }, [data]);

  const activeCount =
    useMemo(() => {
      return data.filter(
        (user) => user.active
      ).length;
    }, [data]);

  const outletAdminCount =
    useMemo(() => {
      return data.filter(
        (user) =>
          user.role ===
          "OUTLET_ADMIN"
      ).length;
    }, [data]);

  const kasirCount =
    useMemo(() => {
      return data.filter(
        (user) =>
          user.role === "KASIR"
      ).length;
    }, [data]);

  // =========================================================
  // ROLE
  // =========================================================

  function getRoleConfig(
    role: string
  ) {
    switch (role) {
      case "ADMIN":
        return {
          label: "ADMIN",
          className:
            "border-red-100 bg-red-50 text-red-700",
          icon: ShieldCheck,
        };

      case "MANAGER":
        return {
          label: "MANAGER",
          className:
            "border-violet-100 bg-violet-50 text-violet-700",
          icon: ShieldCheck,
        };

      case "PURCHASING":
        return {
          label: "PURCHASING",
          className:
            "border-blue-100 bg-blue-50 text-blue-700",
          icon: ShieldCheck,
        };

      case "GUDANG":
        return {
          label: "GUDANG",
          className:
            "border-amber-100 bg-amber-50 text-amber-700",
          icon: ShieldCheck,
        };

      case "OUTLET_ADMIN":
        return {
          label: "OUTLET ADMIN",
          className:
            "border-emerald-100 bg-emerald-50 text-emerald-700",
          icon: ShieldCheck,
        };

      case "KASIR":
        return {
          label: "KASIR",
          className:
            "border-[#BFD4CA] bg-[#EDF5F1] text-[#497F70]",
          icon: UserRound,
        };

      default:
        return {
          label: role,
          className:
            "border-slate-200 bg-slate-50 text-slate-600",
          icon: ShieldCheck,
        };
    }
  }

  // =========================================================
  // LAST SEEN
  // =========================================================

  function formatLastSeen(
    lastSeen?: string | null
  ) {
    if (!lastSeen) {
      return "Belum pernah aktif";
    }

    return new Date(
      lastSeen
    ).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // =========================================================
  // INITIAL
  // =========================================================

  function getInitial(
    fullname?: string
  ) {
    return (
      fullname
        ?.trim()
        ?.charAt(0)
        ?.toUpperCase() ||
      "U"
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-full bg-[#F4F7F5] p-4 md:p-6 lg:p-8">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="mb-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#497F70]" />

              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#497F70]">
                Enterprise Resource Planning
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#18352D] text-white shadow-[0_12px_30px_rgba(24,53,45,0.18)]">
                <Users
                  size={25}
                  strokeWidth={1.8}
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  Master User
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola akun pengguna,
                  foto profil, role,
                  outlet, dan akses
                  sistem.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await loadAll();
              await loadOnlineStatus();
            }}
            disabled={
              loading ||
              onlineLoading ||
              saving ||
              uploadingPhoto
            }
            className="
              inline-flex
              h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              text-sm
              font-semibold
              text-slate-700
              shadow-[0_6px_20px_rgba(15,23,42,0.05)]
              transition
              hover:border-[#BFD4CA]
              hover:bg-[#FAFCFB]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={16}
              className={
                loading ||
                onlineLoading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh Data
          </button>
        </div>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* TOTAL */}

        <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E2] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EDF5F1]" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Total User
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {data.length}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Seluruh akun
                terdaftar
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF5F1] text-[#497F70]">
              <Users size={20} />
            </div>
          </div>
        </div>

        {/* ACTIVE */}

        <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E2] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-50" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Akun Aktif
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-600">
                {activeCount}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Dapat mengakses
                sistem
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        {/* ONLINE */}

        <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E2] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-50" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Sedang Online
              </p>

              <div className="mt-3 flex items-center gap-2">
                <p className="text-3xl font-bold tracking-tight text-[#497F70]">
                  {onlineCount}
                </p>

                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Sinkronisasi setiap
                30 detik
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-[#497F70]">
              <Activity size={20} />
            </div>
          </div>
        </div>

        {/* OUTLET ADMIN */}

        <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E2] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-50" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Outlet Admin
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {outletAdminCount}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                User dengan akses
                outlet
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Building2 size={20} />
            </div>
          </div>
        </div>

        {/* KASIR */}

        <div className="group relative overflow-hidden rounded-[22px] border border-[#DCE8E2] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.045)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#EDF5F1]" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Kasir
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-[#497F70]">
                {kasirCount}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                User operasional POS
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF5F1] text-[#497F70]">
              <UserRound size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* ===================================================
            FORM
        =================================================== */}

        <div
          className={`
            overflow-hidden
            rounded-[24px]
            border
            bg-white
            shadow-[0_10px_35px_rgba(15,23,42,0.055)]
            xl:sticky
            xl:top-6
            ${
              editingUserId !== null
                ? "border-blue-200"
                : "border-[#DCE8E2]"
            }
          `}
        >
          {/* FORM TOP */}

          <div
            className={`
              relative
              overflow-hidden
              border-b
              px-5
              py-5
              ${
                editingUserId !== null
                  ? "border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-white"
                  : "border-[#E7EEE9] bg-gradient-to-br from-[#F3F8F5] via-white to-white"
              }
            `}
          >
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/70" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center
                    rounded-[15px]
                    ${
                      editingUserId !== null
                        ? "bg-blue-100 text-blue-600"
                        : "bg-[#DDEDE5] text-[#497F70]"
                    }
                  `}
                >
                  {editingUserId !==
                  null ? (
                    <Pencil size={19} />
                  ) : (
                    <UserPlus
                      size={19}
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900">
                      {editingUserId !==
                      null
                        ? "Edit User"
                        : "Tambah User"}
                    </h2>

                    {editingUserId !==
                      null && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
                        Editing
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {editingUserId !==
                    null
                      ? "Perbarui informasi akun"
                      : "Buat akun pengguna baru"}
                  </p>
                </div>
              </div>

              {editingUserId !==
                null && (
                <button
                  type="button"
                  onClick={
                    batalEdit
                  }
                  disabled={
                    saving ||
                    uploadingPhoto
                  }
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    text-slate-400
                    shadow-sm
                    transition
                    hover:border-slate-300
                    hover:bg-slate-50
                    hover:text-slate-700
                    disabled:opacity-50
                  "
                  title="Batal edit"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          {/* FORM BODY */}

          <div className="space-y-5 p-5">
            {/* FOTO PROFILE */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Foto Profil
                </label>

                <span className="text-[9px] font-medium text-slate-400">
                  JPG / PNG / WEBP
                </span>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-[#DCE8E2] bg-gradient-to-br from-[#F4F8F6] via-white to-white p-4">
                <div className="flex items-center gap-4">
                  {/* PREVIEW */}

                  <div className="relative shrink-0">
                    <div className="flex h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[22px] border-4 border-white bg-[#E8F2ED] text-2xl font-bold text-[#497F70] shadow-[0_8px_24px_rgba(24,53,45,0.10)]">
                      {form.photo ? (
                        <img
                          src={
                            form.photo
                          }
                          alt="Preview foto profil"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitial(
                          form.fullname
                        )
                      )}
                    </div>

                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#18352D] text-white shadow-sm">
                      <Camera
                        size={13}
                      />
                    </div>
                  </div>

                  {/* INFO */}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      {form.photo
                        ? "Foto profil aktif"
                        : "Belum ada foto"}
                    </p>

                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      {form.photo
                        ? "Foto ini akan tampil sebagai avatar user di sistem."
                        : "Tambahkan foto agar identitas user lebih mudah dikenali."}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={
                          bukaFilePicker
                        }
                        disabled={
                          saving ||
                          uploadingPhoto
                        }
                        className="
                          inline-flex
                          h-8
                          items-center
                          justify-center
                          gap-1.5
                          rounded-lg
                          bg-[#18352D]
                          px-3
                          text-[10px]
                          font-bold
                          text-white
                          transition
                          hover:bg-[#21483D]
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {uploadingPhoto ? (
                          <>
                            <RefreshCw
                              size={12}
                              className="animate-spin"
                            />
                            Uploading...
                          </>
                        ) : (
                          <>
                            {form.photo ? (
                              <Camera
                                size={12}
                              />
                            ) : (
                              <ImagePlus
                                size={12}
                              />
                            )}

                            {form.photo
                              ? "Ganti Foto"
                              : "Pilih Foto"}
                          </>
                        )}
                      </button>

                      {form.photo && (
                        <button
                          type="button"
                          onClick={
                            hapusFoto
                          }
                          disabled={
                            saving ||
                            uploadingPhoto
                          }
                          className="
                            inline-flex
                            h-8
                            items-center
                            justify-center
                            gap-1.5
                            rounded-lg
                            border
                            border-red-100
                            bg-red-50
                            px-3
                            text-[10px]
                            font-bold
                            text-red-600
                            transition
                            hover:bg-red-100
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          <Trash2
                            size={12}
                          />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handlePhotoChange
                  }
                  className="hidden"
                />

                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2">
                  <ImagePlus
                    size={13}
                    className="shrink-0 text-slate-400"
                  />

                  <p className="text-[9px] leading-relaxed text-slate-400">
                    Maksimal 5 MB. Gunakan
                    foto wajah dengan
                    pencahayaan yang jelas.
                  </p>
                </div>
              </div>
            </div>

            {/* USERNAME */}

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Username
              </label>

              <div className="relative">
                <UserRound
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Masukkan username"
                  value={
                    form.username
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      username:
                        e.target.value,
                    })
                  }
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/50
                    pl-10
                    pr-4
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                />
              </div>
            </div>

            {/* NAMA */}

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Nama Lengkap
              </label>

              <div className="relative">
                <Users
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={
                    form.fullname
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fullname:
                        e.target.value,
                    })
                  }
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/50
                    pl-10
                    pr-4
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Password
                </label>

                <LockKeyhole
                  size={14}
                  className="text-slate-300"
                />
              </div>

              {editingUserId !==
                null && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Kosongkan jika password
                  tidak ingin diubah.
                </p>
              )}

              <div className="relative mt-2">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder={
                    editingUserId !==
                    null
                      ? "Kosongkan jika tidak diubah"
                      : "Minimal 6 karakter"
                  }
                  value={
                    form.password
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password:
                        e.target.value,
                    })
                  }
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/50
                    px-4
                    pr-11
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="
                    absolute
                    right-3
                    top-1/2
                    flex
                    h-7
                    w-7
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-400
                    transition
                    hover:bg-slate-100
                    hover:text-slate-700
                  "
                  title={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={16}
                    />
                  ) : (
                    <Eye
                      size={16}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* ROLE */}

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Role & Hak Akses
              </label>

              <div className="relative">
                <ShieldCheck
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={
                    form.role
                  }
                  onChange={(e) =>
                    handleRoleChange(
                      e.target.value
                    )
                  }
                  className="
                    h-11
                    w-full
                    appearance-none
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/50
                    pl-10
                    pr-10
                    text-sm
                    font-medium
                    text-slate-800
                    outline-none
                    transition
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                >
                  <option value="ADMIN">
                    ADMIN
                  </option>

                  <option value="MANAGER">
                    MANAGER
                  </option>

                  <option value="PURCHASING">
                    PURCHASING
                  </option>

                  <option value="GUDANG">
                    GUDANG
                  </option>

                  <option value="OUTLET_ADMIN">
                    OUTLET ADMIN
                  </option>

                  <option value="KASIR">
                    KASIR
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              {/* ROLE DESCRIPTION */}

              {form.role ===
                "KASIR" && (
                <div className="mt-2 rounded-xl border border-[#DCE8E2] bg-[#F4F8F6] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <UserRound
                      size={14}
                      className="mt-0.5 shrink-0 text-[#497F70]"
                    />

                    <div>
                      <p className="text-[10px] font-bold text-[#497F70]">
                        Kasir Outlet
                      </p>

                      <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                        User ini digunakan
                        untuk operasional POS
                        dan wajib terikat ke
                        satu outlet.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OUTLET */}

            {isOutletRole(
              form.role
            ) && (
              <div
                className={`
                  rounded-2xl
                  border
                  p-3.5
                  ${
                    form.role ===
                    "KASIR"
                      ? "border-[#BFD4CA] bg-[#F1F7F4]"
                      : "border-emerald-100 bg-emerald-50/50"
                  }
                `}
              >
                <label
                  className={`
                    mb-2
                    block
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.12em]
                    ${
                      form.role ===
                      "KASIR"
                        ? "text-[#497F70]"
                        : "text-emerald-700"
                    }
                  `}
                >
                  Penempatan Outlet
                </label>

                <div className="relative">
                  <Building2
                    size={16}
                    className={`
                      absolute
                      left-3.5
                      top-1/2
                      -translate-y-1/2
                      ${
                        form.role ===
                        "KASIR"
                          ? "text-[#497F70]"
                          : "text-emerald-600"
                      }
                    `}
                  />

                  <select
                    value={
                      form.outletId
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        outletId:
                          e.target
                            .value,
                      })
                    }
                    className={`
                      h-11
                      w-full
                      appearance-none
                      rounded-xl
                      border
                      bg-white
                      pl-10
                      pr-10
                      text-sm
                      font-medium
                      text-slate-800
                      outline-none
                      transition
                      ${
                        form.role ===
                        "KASIR"
                          ? "border-[#BFD4CA] focus:border-[#497F70] focus:ring-4 focus:ring-[#497F70]/8"
                          : "border-emerald-100 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/8"
                      }
                    `}
                  >
                    <option value="">
                      Pilih Outlet
                    </option>

                    {outlets.map(
                      (outlet) => (
                        <option
                          key={
                            outlet.id
                          }
                          value={
                            outlet.id
                          }
                        >
                          {
                            outlet.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                {form.role ===
                  "KASIR" && (
                  <p className="mt-2 text-[9px] font-medium text-[#497F70]">
                    Kasir hanya dapat
                    bekerja pada outlet
                    yang dipilih.
                  </p>
                )}

                {outlets.length ===
                  0 && (
                  <p className="mt-2 text-[10px] font-medium text-amber-600">
                    Belum ada outlet
                    yang tersedia.
                  </p>
                )}
              </div>
            )}

            {/* STATUS */}

            {editingUserId !==
              null && (
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Status Akun
                </label>

                <div className="relative">
                  <Circle
                    size={13}
                    fill="currentColor"
                    className={`
                      absolute
                      left-4
                      top-1/2
                      -translate-y-1/2
                      ${
                        form.active
                          ? "text-emerald-500"
                          : "text-slate-300"
                      }
                    `}
                  />

                  <select
                    value={
                      form.active
                        ? "true"
                        : "false"
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        active:
                          e.target
                            .value ===
                          "true",
                      })
                    }
                    className="
                      h-11
                      w-full
                      appearance-none
                      rounded-xl
                      border
                      border-slate-200
                      bg-slate-50/50
                      pl-10
                      pr-10
                      text-sm
                      font-medium
                      text-slate-800
                      outline-none
                      transition
                      focus:border-[#497F70]
                      focus:bg-white
                      focus:ring-4
                      focus:ring-[#497F70]/8
                    "
                  >
                    <option value="true">
                      Aktif
                    </option>

                    <option value="false">
                      Nonaktif
                    </option>
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* DIVIDER */}

            <div className="h-px bg-slate-100" />

            {/* SAVE */}

            <button
              type="button"
              onClick={simpan}
              disabled={
                saving ||
                uploadingPhoto
              }
              className={`
                flex
                h-12
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                px-5
                text-sm
                font-bold
                text-white
                shadow-[0_8px_20px_rgba(24,53,45,0.14)]
                transition
                active:scale-[0.99]
                disabled:cursor-not-allowed
                disabled:opacity-60
                ${
                  editingUserId !==
                  null
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-[#18352D] hover:bg-[#21483D]"
                }
              `}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                  Menyimpan...
                </>
              ) : editingUserId !==
                null ? (
                <>
                  <Save size={17} />
                  Simpan Perubahan
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Simpan User
                </>
              )}
            </button>

            {editingUserId !==
              null && (
              <button
                type="button"
                onClick={
                  batalEdit
                }
                disabled={
                  saving ||
                  uploadingPhoto
                }
                className="
                  flex
                  h-11
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-sm
                  font-semibold
                  text-slate-600
                  transition
                  hover:bg-slate-50
                  disabled:opacity-50
                "
              >
                <X size={16} />
                Batal Edit
              </button>
            )}
          </div>
        </div>

        {/* ===================================================
            USER TABLE
        =================================================== */}

        <div className="min-w-0 overflow-hidden rounded-[24px] border border-[#DCE8E2] bg-white shadow-[0_10px_35px_rgba(15,23,42,0.055)]">
          {/* TABLE HEADER */}

          <div className="border-b border-[#E7EEE9] bg-white px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Daftar User
                  </h2>

                  <span className="rounded-full bg-[#EDF5F1] px-2.5 py-1 text-[10px] font-bold text-[#497F70]">
                    {
                      filteredUsers.length
                    }
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Monitor akun, role,
                  outlet, aktivitas,
                  dan profil pengguna.
                </p>
              </div>

              <div className="relative w-full lg:w-[300px]">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Cari nama, username, role..."
                  value={
                    search
                  }
                  onChange={(e) =>
                    setSearch(
                      e.target
                        .value
                    )
                  }
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/60
                    pl-10
                    pr-4
                    text-sm
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-[#497F70]
                    focus:bg-white
                    focus:ring-4
                    focus:ring-[#497F70]/8
                  "
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-[#E8EEE9] bg-[#F8FAF9]">
                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    User
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Username
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Role
                  </th>

                  <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Outlet
                  </th>

                  <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Akun
                  </th>

                  <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Aktivitas
                  </th>

                  <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EDF1EE]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDF5F1]">
                        <RefreshCw
                          size={21}
                          className="animate-spin text-[#497F70]"
                        />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-600">
                        Memuat data
                        user
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Menyiapkan daftar
                        pengguna...
                      </p>
                    </td>
                  </tr>
                ) : filteredUsers.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                        <Users
                          size={25}
                        />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-600">
                        Tidak ada user
                        ditemukan
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Coba gunakan kata
                        kunci pencarian
                        lainnya.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(
                    (user) => {
                      const roleConfig =
                        getRoleConfig(
                          user.role
                        );

                      const RoleIcon =
                        roleConfig.icon;

                      return (
                        <tr
                          key={
                            user.id
                          }
                          className={`
                            group
                            transition
                            ${
                              editingUserId ===
                              user.id
                                ? "bg-blue-50/50"
                                : "hover:bg-[#FAFCFB]"
                            }
                          `}
                        >
                          {/* USER */}

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <div
                                  className={`
                                    flex
                                    h-11
                                    w-11
                                    items-center
                                    justify-center
                                    overflow-hidden
                                    rounded-[15px]
                                    text-sm
                                    font-bold
                                    ${
                                      editingUserId ===
                                      user.id
                                        ? "bg-blue-100 text-blue-600"
                                        : "bg-[#E8F2ED] text-[#497F70]"
                                    }
                                  `}
                                >
                                  {user.photo ? (
                                    <img
                                      src={
                                        user.photo
                                      }
                                      alt={
                                        user.fullname ||
                                        "User"
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getInitial(
                                      user.fullname
                                    )
                                  )}
                                </div>

                                <span
                                  className={`
                                    absolute
                                    bottom-0.5
                                    right-0.5
                                    h-3
                                    w-3
                                    rounded-full
                                    border-2
                                    border-white
                                    ${
                                      user.online
                                        ? "bg-emerald-500"
                                        : "bg-slate-300"
                                    }
                                  `}
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">
                                  {
                                    user.fullname
                                  }
                                </p>

                                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                  USER ID #
                                  {
                                    user.id
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* USERNAME */}

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs font-medium text-slate-600">
                              @
                              {
                                user.username
                              }
                            </span>
                          </td>

                          {/* ROLE */}

                          <td className="px-5 py-4">
                            <span
                              className={`
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                border
                                px-2.5
                                py-1.5
                                text-[10px]
                                font-bold
                                tracking-wide
                                ${roleConfig.className}
                              `}
                            >
                              <RoleIcon
                                size={
                                  12
                                }
                              />

                              {
                                roleConfig.label
                              }
                            </span>
                          </td>

                          {/* OUTLET */}

                          <td className="px-5 py-4">
                            {user.outlet
                              ?.name ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className={`
                                    flex
                                    h-8
                                    w-8
                                    items-center
                                    justify-center
                                    rounded-lg
                                    ${
                                      user.role ===
                                      "KASIR"
                                        ? "bg-[#EDF5F1] text-[#497F70]"
                                        : "bg-slate-50 text-slate-400"
                                    }
                                  `}
                                >
                                  <Building2
                                    size={
                                      14
                                    }
                                  />
                                </div>

                                <div>
                                  <span className="block text-sm font-medium text-slate-700">
                                    {
                                      user
                                        .outlet
                                        .name
                                    }
                                  </span>

                                  {user.role ===
                                    "KASIR" && (
                                    <span className="text-[9px] font-medium text-[#497F70]">
                                      Outlet Kasir
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-400">
                                Pusat
                              </span>
                            )}
                          </td>

                          {/* ACCOUNT STATUS */}

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                px-2.5
                                py-1.5
                                text-[10px]
                                font-bold
                                ${
                                  user.active
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-600"
                                }
                              `}
                            >
                              <span
                                className={`
                                  h-1.5
                                  w-1.5
                                  rounded-full
                                  ${
                                    user.active
                                      ? "bg-emerald-500"
                                      : "bg-red-500"
                                  }
                                `}
                              />

                              {user.active
                                ? "AKTIF"
                                : "NONAKTIF"}
                            </span>
                          </td>

                          {/* ONLINE */}

                          <td className="px-5 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`
                                  inline-flex
                                  items-center
                                  gap-1.5
                                  rounded-full
                                  px-2.5
                                  py-1.5
                                  text-[10px]
                                  font-bold
                                  ${
                                    user.online
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  }
                                `}
                              >
                                {user.online ? (
                                  <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                  </span>
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                                )}

                                {user.online
                                  ? "ONLINE"
                                  : "OFFLINE"}
                              </span>

                              {!user.online &&
                                user.lastSeen && (
                                  <span className="mt-1.5 text-[9px] text-slate-400">
                                    {formatLastSeen(
                                      user.lastSeen
                                    )}
                                  </span>
                                )}
                            </div>
                          </td>

                          {/* ACTION */}

                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                mulaiEdit(
                                  user
                                )
                              }
                              className="
                                inline-flex
                                h-9
                                items-center
                                justify-center
                                gap-1.5
                                rounded-xl
                                border
                                border-slate-200
                                bg-white
                                px-3
                                text-xs
                                font-bold
                                text-slate-600
                                shadow-sm
                                transition
                                hover:border-blue-200
                                hover:bg-blue-50
                                hover:text-blue-600
                              "
                              title="Edit user"
                            >
                              <Pencil
                                size={
                                  13
                                }
                              />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}

          {!loading &&
            filteredUsers.length >
              0 && (
              <div className="flex flex-col gap-2 border-t border-[#E8EEE9] bg-[#FBFCFB] px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] font-medium text-slate-400">
                  Menampilkan{" "}
                  <span className="font-bold text-slate-600">
                    {
                      filteredUsers.length
                    }
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-slate-600">
                    {data.length}
                  </span>{" "}
                  user
                </p>

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      onlineLoading
                        ? "animate-pulse bg-amber-400"
                        : "bg-emerald-500"
                    }`}
                  />

                  {onlineLoading
                    ? "Memperbarui status..."
                    : "Status online tersinkronisasi"}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}