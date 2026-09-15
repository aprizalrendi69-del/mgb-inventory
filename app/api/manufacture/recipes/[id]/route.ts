import { NextRequest, NextResponse } from "next/server";

import {
  PUT as PUT_RECIPES,
  PATCH as PATCH_RECIPES,
  DELETE as DELETE_RECIPES,
} from "../route";

/*
===========================================================
MANUFACTURE RECIPE DETAIL API
===========================================================

Endpoint:

PUT    /api/manufacture/recipes/:id
PATCH  /api/manufacture/recipes/:id
DELETE /api/manufacture/recipes/:id

Contoh:

PUT /api/manufacture/recipes/1

Body:

{
  "code": "RCP-001",
  "name": "Sauce",
  "outletId": 1,
  "productCkId": null,
  "outputBarangId": 10,
  "outputQty": 1,
  "notes": "...",
  "active": true,
  "items": [
    {
      "barangId": 20,
      "qty": 0.5,
      "unit": "KG"
    }
  ]
}

===========================================================
PENTING
===========================================================

Route utama:

/api/manufacture/recipes/route.ts

sudah memiliki seluruh logic:

- authentication
- role
- outlet ownership
- validation
- Product CK
- output barang
- recipe items
- duplicate code
- transaction
- delete protection

File ini hanya bertugas mengambil:

/recipes/[id]

lalu meneruskan ID tersebut ke route utama.

Dengan begitu:

PUT /api/manufacture/recipes/1

akan diproses sebagai:

PUT /api/manufacture/recipes?id=1

tanpa perlu mengubah logic utama.
===========================================================
*/

export const dynamic = "force-dynamic";

/*
===========================================================
HELPER
===========================================================
*/

async function forwardRequest(
  req: NextRequest,
  id: string,
  handler: (
    request: NextRequest,
  ) => Promise<Response>,
) {
  /*
   * ---------------------------------------------------------
   * VALIDATE ID
   * ---------------------------------------------------------
   */

  const numericId = Number(id);

  if (
    !Number.isInteger(numericId) ||
    numericId <= 0
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "ID Recipe tidak valid.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * ---------------------------------------------------------
   * URL
   * ---------------------------------------------------------
   *
   * Tambahkan:
   *
   * ?id=1
   *
   * ke request yang diteruskan ke route utama.
   */

  const url = new URL(req.url);

  url.searchParams.set(
    "id",
    String(numericId),
  );

  /*
   * ---------------------------------------------------------
   * BODY
   * ---------------------------------------------------------
   *
   * Request body hanya bisa dibaca sekali.
   *
   * Karena handler utama membaca:
   *
   * await req.json()
   *
   * kita baca body lalu buat NextRequest baru.
   */

  let body: string | undefined;

  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    body = await req.text();
  }

  /*
   * ---------------------------------------------------------
   * REQUEST BARU
   * ---------------------------------------------------------
   */

  const forwardedRequest =
    new NextRequest(
      url,
      {
        method: req.method,

        headers: req.headers,

        body:
          body !== undefined
            ? body
            : undefined,
      },
    );

  /*
   * ---------------------------------------------------------
   * FORWARD
   * ---------------------------------------------------------
   */

  return handler(
    forwardedRequest,
  );
}

/*
===========================================================
PUT
===========================================================

PUT /api/manufacture/recipes/1

akan diteruskan menjadi:

PUT /api/manufacture/recipes?id=1
===========================================================
*/

export async function PUT(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const { id } =
      await context.params;

    return await forwardRequest(
      req,
      id,
      PUT_RECIPES,
    );
  } catch (error: any) {
    console.error(
      "PUT /api/manufacture/recipes/[id]:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui Recipe/BOM.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
===========================================================
PATCH
===========================================================

PATCH /api/manufacture/recipes/1

Tetap menggunakan logic PUT dari route utama.
===========================================================
*/

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const { id } =
      await context.params;

    return await forwardRequest(
      req,
      id,
      PATCH_RECIPES,
    );
  } catch (error: any) {
    console.error(
      "PATCH /api/manufacture/recipes/[id]:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal memperbarui Recipe/BOM.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
===========================================================
DELETE
===========================================================

DELETE /api/manufacture/recipes/1

akan diteruskan menjadi:

DELETE /api/manufacture/recipes?id=1
===========================================================
*/

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const { id } =
      await context.params;

    return await forwardRequest(
      req,
      id,
      DELETE_RECIPES,
    );
  } catch (error: any) {
    console.error(
      "DELETE /api/manufacture/recipes/[id]:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal menghapus Recipe/BOM.",
      },
      {
        status: 500,
      },
    );
  }
}