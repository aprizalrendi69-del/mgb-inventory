import { NextRequest, NextResponse } from "next/server";

import {
  GET as GET_RECIPES,
  PUT as PUT_RECIPES,
  PATCH as PATCH_RECIPES,
  DELETE as DELETE_RECIPES,
} from "../route";

export const dynamic = "force-dynamic";

/*
===========================================================
MANUFACTURE RECIPE DETAIL API
===========================================================

Endpoint:

GET    /api/manufacture/recipes/:id
PUT    /api/manufacture/recipes/:id
PATCH  /api/manufacture/recipes/:id
DELETE /api/manufacture/recipes/:id

Contoh:

GET
/api/manufacture/recipes/1

PUT
/api/manufacture/recipes/1

Body:

{
  "code": "RCP-001",
  "name": "Sauce",
  "outletId": 1,
  "productCkId": null,
  "outputBarangId": 10,
  "outputQty": 1,
  "active": true,
  "items": [
    {
      "barangId": 20,
      "qty": 0.06,
      "unit": "liter"
    }
  ]
}

===========================================================
PENTING
===========================================================

Seluruh logic utama berada di:

/api/manufacture/recipes/route.ts

Route utama menangani:

- authentication
- session
- role
- outlet ownership
- validation
- Product CK
- output barang
- Recipe / BOM
- duplicate code
- transaction
- delete protection
- normalisasi BOM ke BASE UNIT

File [id]/route.ts ini hanya:

1. mengambil ID dari URL
2. memasukkan ID ke query parameter ?id=
3. meneruskan request ke route utama

Contoh:

PUT
/api/manufacture/recipes/1

diteruskan menjadi:

PUT
/api/manufacture/recipes?id=1

===========================================================
BASE UNIT
===========================================================

Recipe / BOM selalu diproses oleh route utama sebagai BASE UNIT.

Contoh:

Barang:
unit           = jerigen
baseUnit       = liter
conversionRate = 13

Input:

qty  = 0.06
unit = liter

HASIL:

qty  = 0.06
unit = liter

Tidak dikonversi lagi.

Sedangkan:

qty  = 1
unit = jerigen

HASIL:

qty  = 13
unit = liter

Jadi file ini TIDAK boleh melakukan:

toBaseQty()
convertQty()
conversionRate
atau konversi lain.

===========================================================
*/

/*
===========================================================
FORWARD REQUEST
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
  ---------------------------------------------------------
  VALIDATE ID
  ---------------------------------------------------------
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
  ---------------------------------------------------------
  URL
  ---------------------------------------------------------
  */

  const url = new URL(req.url);

  /*
   * Pastikan ID dari path menjadi sumber ID utama.
   *
   * Contoh:
   *
   * /recipes/15
   *
   * menjadi:
   *
   * /recipes?id=15
   */
  url.searchParams.set(
    "id",
    String(numericId),
  );

  /*
  ---------------------------------------------------------
  BODY
  ---------------------------------------------------------
  *
  * Request body hanya dapat dibaca satu kali.
  *
  * PUT/PATCH membutuhkan body karena route utama
  * memanggil:
  *
  * await req.json()
  *
  * Karena itu body dibaca di sini kemudian dimasukkan
  * ke NextRequest baru.
  */

  let body:
    | string
    | undefined;

  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    body = await req.text();
  }

  /*
  ---------------------------------------------------------
  HEADERS
  ---------------------------------------------------------
  *
  * Header asli dipertahankan.
  *
  * Ini penting agar cookie/session tetap dapat dibaca
  * oleh route utama.
  */

  const headers =
    new Headers(req.headers);

  /*
   * Kalau body diteruskan, pastikan content-length lama
   * tidak menyebabkan mismatch pada request baru.
   *
   * Browser biasanya mengirim content-type application/json
   * dan header tersebut tetap dipertahankan.
   */
  headers.delete(
    "content-length",
  );

  /*
  ---------------------------------------------------------
  REQUEST BARU
  ---------------------------------------------------------
  */

  const forwardedRequest =
    new NextRequest(
      url,
      {
        method: req.method,

        headers,

        body:
          body !== undefined
            ? body
            : undefined,
      },
    );

  /*
  ---------------------------------------------------------
  FORWARD KE ROUTE UTAMA
  ---------------------------------------------------------
  */

  return handler(
    forwardedRequest,
  );
}

/*
===========================================================
GET
===========================================================

GET:

/api/manufacture/recipes/1

diteruskan menjadi:

/api/manufacture/recipes?id=1

Route utama akan mengembalikan Recipe lengkap termasuk:

- outputBarang
- productCk
- items
- barang bahan
- baseUnit
- conversionRate
===========================================================
*/

export async function GET(
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
      GET_RECIPES,
    );
  } catch (error: any) {
    console.error(
      "GET /api/manufacture/recipes/[id]:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Gagal mengambil Recipe/BOM.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
===========================================================
PUT
===========================================================

PUT:

/api/manufacture/recipes/1

diteruskan menjadi:

/api/manufacture/recipes?id=1

Semua validasi dan normalisasi qty dilakukan oleh route
utama.

Contoh:

{
  "items": [
    {
      "barangId": 20,
      "qty": 0.06,
      "unit": "liter"
    }
  ]
}

Akan tetap menjadi:

0.06 liter

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

PATCH:

/api/manufacture/recipes/1

diteruskan menjadi:

/api/manufacture/recipes?id=1

Route utama akan menggunakan logic PATCH/partial update.
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

DELETE:

/api/manufacture/recipes/1

diteruskan menjadi:

/api/manufacture/recipes?id=1

Route utama akan melakukan:

- authentication
- role check
- outlet ownership
- check ManufactureOrder
- delete RecipeItem
- delete Recipe

Tidak ada reset database.
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