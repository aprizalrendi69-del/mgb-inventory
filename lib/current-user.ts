import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { Role } from "@prisma/client";

import {
  hasPermission,
  Permission,
} from "@/lib/permissions";

export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);

    if (
      typeof decoded !== "object" ||
      decoded === null
    ) {
      return null;
    }

    const data = decoded as {
      id?: number | string;
      username?: string;
      role?: string;
    };

    if (
      data.id === undefined ||
      !data.username ||
      !data.role
    ) {
      return null;
    }

    return {
      id: Number(data.id),
      username: data.username,
      role: data.role as Role,
    };

  } catch (error) {
    console.error(
      "Gagal mengambil current user:",
      error
    );

    return null;
  }
}


/**
 * Cek apakah user yang sedang login
 * mempunyai permission tertentu.
 */
export async function checkPermission(
  permission: Permission
): Promise<CurrentUser | null> {

  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const allowed = hasPermission(
    user.role,
    permission
  );

  if (!allowed) {
    return null;
  }

  return user;
}