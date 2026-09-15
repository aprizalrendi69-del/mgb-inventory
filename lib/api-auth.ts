import { NextResponse } from "next/server";

import {
  checkPermission,
  CurrentUser,
} from "@/lib/current-user";

import { Permission } from "@/lib/permissions";

export async function requirePermission(
  permission: Permission
): Promise<
  | {
      user: CurrentUser;
      error: null;
    }
  | {
      user: null;
      error: NextResponse;
    }
> {

  const user = await checkPermission(permission);

  if (!user) {
    return {
      user: null,

      error: NextResponse.json(
        {
          success: false,
          message: "Anda tidak memiliki hak akses",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    user,
    error: null,
  };
}