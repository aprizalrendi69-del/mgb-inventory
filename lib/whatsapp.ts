// =========================================================
// MGB ERP - WhatsApp Helper
// Purchase Order + Delivery Order + Surat Jalan
// =========================================================

// =========================================================
// PURCHASE TYPES
// =========================================================

type PurchaseItem = {
  qty?: number | string | null;
  price?: number | string | null;

  barang?: {
    code?: string | null;
    name?: string | null;
    unit?: string | null;
  } | null;
};

type PurchaseSupplier = {
  name?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
};

type PurchaseData = {
  number?: string | null;
  purchaseDate?: string | Date | null;
  paymentMethod?: string | null;
  total?: number | string | null;
  remarks?: string | null;

  supplier?: PurchaseSupplier | null;

  items?: PurchaseItem[] | null;
};

// =========================================================
// DELIVERY ORDER TYPES
// =========================================================

type DeliveryItem = {
  qty?: number | string | null;
  price?: number | string | null;
  subtotal?: number | string | null;

  barang?: {
    code?: string | null;
    name?: string | null;
    unit?: string | null;
    sellingPrice?: number | string | null;
  } | null;
};

type DeliveryCustomer = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type DeliverySuratJalan = {
  number?: string | null;
};

type DeliveryData = {
  id?: number | string | null;

  number?: string | null;
  deliveryDate?: string | Date | null;
  status?: string | null;
  totalQty?: number | string | null;
  remarks?: string | null;

  customer?: DeliveryCustomer | null;

  suratJalan?: DeliverySuratJalan | null;

  items?: DeliveryItem[] | null;
};

// =========================================================
// CONSTANTS
// =========================================================

const DIVIDER = "━━━━━━━━━━━━━━━━";

// =========================================================
// FORMAT ANGKA
// =========================================================

function formatNumber(value: unknown): string {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return Math.round(number).toLocaleString("id-ID");
}

// =========================================================
// FORMAT RUPIAH
// =========================================================

function formatRupiah(value: unknown): string {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return Math.round(number).toLocaleString("id-ID");
}

// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(value: unknown): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value as string | Date);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// =========================================================
// BUILD WHATSAPP PURCHASE MESSAGE
// =========================================================

export function buildWhatsAppPurchaseMessage(
  purchase: PurchaseData
): string {
  if (!purchase) {
    throw new Error(
      "Data Purchase Order tidak tersedia."
    );
  }

  const number = String(
    purchase.number ?? ""
  ).trim();

  if (!number) {
    throw new Error(
      "Nomor Purchase Order tidak tersedia."
    );
  }

  const supplierName = String(
    purchase.supplier?.name ?? "-"
  ).trim();

  const purchaseDate = formatDate(
    purchase.purchaseDate
  );

  const total = Number(
    purchase.total ?? 0
  );

  const items = Array.isArray(
    purchase.items
  )
    ? purchase.items
    : [];

  const lines: string[] = [];

  // =======================================================
  // HEADER
  // =======================================================

  lines.push(
    "🛒  *`PURCHASE ORDER`*"
  );

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // ORDER INFORMATION
  // =======================================================

  lines.push(
    "> *ORDER INFORMATION* :"
  );

  lines.push("");

  lines.push(
    `*PO NUMBER*   : ${number}`
  );

  lines.push(
    `*SUPPLIER*    : ${supplierName}`
  );

  lines.push(
    `*ORDER DATE*  : ${purchaseDate}`
  );

  lines.push("");

  // =======================================================
  // ORDER DETAILS
  // =======================================================

  lines.push(
    "> *ORDER DETAILS* :"
  );

  lines.push("");

  if (items.length === 0) {
    lines.push(
      "*Tidak ada item pembelian.*"
    );
  } else {
    items.forEach((item, index) => {
      const name = String(
        item.barang?.name ?? "-"
      ).trim();

      const unit = String(
        item.barang?.unit ?? ""
      ).trim();

      const qty = Number(
        item.qty ?? 0
      );

      const price = Number(
        item.price ?? 0
      );

      const subtotal =
        qty * price;

      const qtyText = unit
        ? `${formatNumber(qty)} ${unit}`
        : formatNumber(qty);

      const itemNumber = String(
        index + 1
      ).padStart(2, "0");

      lines.push(
        `*${itemNumber} · ${name}*`
      );

      lines.push(
        `Qty           : *${qtyText}*`
      );

      lines.push(
        `Unit Price    : *Rp ${formatRupiah(
          price
        )}*`
      );

      lines.push(
        `Subtotal      : *Rp ${formatRupiah(
          subtotal
        )}*`
      );

      if (index < items.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // GRAND TOTAL
  // =======================================================

  lines.push(
    `*GRAND TOTAL* : *Rp ${formatRupiah(
      total
    )}*`
  );

  lines.push("");

  // =======================================================
  // IMPORTANT NOTE
  // =======================================================

  lines.push(
    "> *IMPORTANT NOTE* :"
  );

  lines.push("");

  lines.push(
    "Mohon Purchase Order ini diproses sesuai dengan rincian pesanan yang tercantum di atas ya Bapak/Ibu."
  );

  lines.push("");

  lines.push(
    "Apabila terdapat perubahan harga, jumlah, ketersediaan barang, maupun ketentuan lainnya, mohon dikonfirmasikan terlebih dahulu kepada pihak kami."
  );

  lines.push("");

  lines.push(
    "Terima kasih atas perhatian, kerja sama, dan pelayanan yang diberikan."
  );

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // FOOTER
  // =======================================================

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push(
    "_*Purchase Management • Inventory • Finance*_"
  );

  return lines.join("\n");
}

// =========================================================
// BUILD WHATSAPP PURCHASE URL
// =========================================================

export function buildWhatsAppPurchaseUrl(
  purchase: PurchaseData
): string {
  const message =
    buildWhatsAppPurchaseMessage(
      purchase
    );

  const encodedMessage =
    encodeURIComponent(message);

  return `https://web.whatsapp.com/send?text=${encodedMessage}`;
}

// =========================================================
// HITUNG TOTAL DELIVERY
// =========================================================

function calculateDeliveryTotal(
  items: DeliveryItem[]
): number {
  return items.reduce(
    (total, item) => {
      const qty = Number(
        item.qty ?? 0
      );

      const price = Number(
        item.price ??
          item.barang?.sellingPrice ??
          0
      );

      let subtotal: number;

      if (
        item.subtotal !== null &&
        item.subtotal !== undefined &&
        Number.isFinite(
          Number(item.subtotal)
        )
      ) {
        subtotal = Number(
          item.subtotal
        );
      } else {
        subtotal =
          qty * price;
      }

      if (!Number.isFinite(subtotal)) {
        return total;
      }

      return total + subtotal;
    },
    0
  );
}

// =========================================================
// BUILD WHATSAPP DELIVERY ORDER MESSAGE
// =========================================================

export function buildWhatsAppDeliveryOrderMessage(
  delivery: DeliveryData
): string {
  if (!delivery) {
    throw new Error(
      "Data Delivery Order tidak tersedia."
    );
  }

  const number = String(
    delivery.number ?? ""
  ).trim();

  if (!number) {
    throw new Error(
      "Nomor Delivery Order tidak tersedia."
    );
  }

  const customerName = String(
    delivery.customer?.name ?? "-"
  ).trim();

  const deliveryDate = formatDate(
    delivery.deliveryDate
  );

  const items = Array.isArray(
    delivery.items
  )
    ? delivery.items
    : [];

  const totalValue =
    calculateDeliveryTotal(items);

  const lines: string[] = [];

  // =======================================================
  // HEADER
  // =======================================================

  lines.push(
    "*DELIVERY ORDER*"
  );

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // INFORMASI PENGIRIMAN
  // =======================================================

  lines.push(
    "> *INFORMASI PENGIRIMAN*"
  );

  lines.push("");

  lines.push(
    `*No. DO* : ${number}`
  );

  lines.push(
    `*Customer* : ${customerName}`
  );

  lines.push(
    `*Tanggal* : ${deliveryDate}`
  );

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // DETAIL PENGIRIMAN
  // =======================================================

  lines.push(
    "> *DETAIL PENGIRIMAN*"
  );

  lines.push("");

  if (items.length === 0) {
    lines.push(
      "*Tidak ada barang yang dikirim.*"
    );
  } else {
    items.forEach((item, index) => {
      const name = String(
        item.barang?.name ?? "-"
      ).trim();

      const unit = String(
        item.barang?.unit ?? ""
      ).trim();

      const qty = Number(
        item.qty ?? 0
      );

      const price = Number(
        item.price ??
          item.barang?.sellingPrice ??
          0
      );

      const subtotal =
        item.subtotal !== null &&
        item.subtotal !== undefined &&
        Number.isFinite(
          Number(item.subtotal)
        )
          ? Number(item.subtotal)
          : qty * price;

      const qtyText = unit
        ? `${formatNumber(qty)} ${unit}`
        : formatNumber(qty);

      const itemNumber = String(
        index + 1
      ).padStart(2, "0");

      lines.push(
        `*${itemNumber} · ${name}*`
      );

      lines.push(
        `Qty      : *${qtyText}*`
      );

      lines.push(
        `Harga    : *Rp ${formatRupiah(
          price
        )}*`
      );

      lines.push(
        `Subtotal : *Rp ${formatRupiah(
          subtotal
        )}*`
      );

      if (index < items.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // TOTAL
  // =======================================================

  lines.push(
    "*TOTAL PENGIRIMAN*"
  );

  lines.push(
    `*Rp ${formatRupiah(
      totalValue
    )}*`
  );

  // =======================================================
  // CATATAN
  // =======================================================

  const remarks = String(
    delivery.remarks ?? ""
  ).trim();

  if (remarks) {
    lines.push("");

    lines.push(DIVIDER);

    lines.push("");

    lines.push(
      "*CATATAN*"
    );

    lines.push("");

    lines.push(remarks);
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // FOOTER
  // =======================================================

  lines.push(
    "Demikian pemberitahuan pengiriman barang."
  );

  lines.push(
    "Terima kasih atas kerja sama dan pelayanannya."
  );

  lines.push("");

  lines.push(
    "*MGB ERP*"
  );

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push(
    "*Purchase • Inventory • Finance*"
  );

  return lines.join("\n");
}

// =========================================================
// BUILD WHATSAPP DELIVERY ORDER URL
// =========================================================

export function buildWhatsAppDeliveryOrderUrl(
  delivery: DeliveryData
): string {
  const message =
    buildWhatsAppDeliveryOrderMessage(
      delivery
    );

  const encodedMessage =
    encodeURIComponent(message);

  return `https://web.whatsapp.com/send?text=${encodedMessage}`;
}

// =========================================================
// BUILD WHATSAPP SURAT JALAN MESSAGE
// =========================================================

export function buildWhatsAppSuratJalanMessage(
  delivery: DeliveryData
): string {
  if (!delivery) {
    throw new Error(
      "Data Surat Jalan tidak tersedia."
    );
  }

  const deliveryNumber = String(
    delivery.number ?? ""
  ).trim();

  const suratJalanNumber = String(
    delivery.suratJalan?.number ?? ""
  ).trim();

  if (!suratJalanNumber) {
    throw new Error(
      "Nomor Surat Jalan tidak tersedia."
    );
  }

  const customerName = String(
    delivery.customer?.name ?? "-"
  ).trim();

  const customerAddress = String(
    delivery.customer?.address ?? ""
  ).trim();

  const deliveryDate = formatDate(
    delivery.deliveryDate
  );

  const items = Array.isArray(
    delivery.items
  )
    ? delivery.items
    : [];

  const totalValue =
    calculateDeliveryTotal(items);

  const remarks = String(
    delivery.remarks ?? ""
  ).trim();

  const lines: string[] = [];

  // =======================================================
  // HEADER
  // =======================================================

  lines.push(
    "🚚 *`SURAT JALAN`*"
  );

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // INFORMASI PENGIRIMAN
  // =======================================================

  lines.push(
    "*INFORMASI PENGIRIMAN* :"
  );

  lines.push("");

  lines.push(
    `*NO. SURAT JALAN* : ${suratJalanNumber}`
  );

  if (deliveryNumber) {
    lines.push(
      `*NO. DELIVERY*    : ${deliveryNumber}`
    );
  }

  lines.push(
    `*CUSTOMER*        : ${customerName}`
  );

  lines.push(
    `*TANGGAL*         : ${deliveryDate}`
  );

  if (customerAddress) {
    lines.push(
      `*ALAMAT*          : ${customerAddress}`
    );
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // DETAIL BARANG
  // =======================================================

  lines.push(
    "> *DETAIL PENGIRIMAN* :"
  );

  lines.push("");

  if (items.length === 0) {
    lines.push(
      "*Tidak ada barang yang dikirim.*"
    );
  } else {
    items.forEach((item, index) => {
      const name = String(
        item.barang?.name ?? "-"
      ).trim();

      const code = String(
        item.barang?.code ?? ""
      ).trim();

      const unit = String(
        item.barang?.unit ?? ""
      ).trim();

      const qty = Number(
        item.qty ?? 0
      );

      const price = Number(
        item.price ??
          item.barang?.sellingPrice ??
          0
      );

      const subtotal =
        item.subtotal !== null &&
        item.subtotal !== undefined &&
        Number.isFinite(
          Number(item.subtotal)
        )
          ? Number(item.subtotal)
          : qty * price;

      const qtyText = unit
        ? `${formatNumber(qty)} ${unit}`
        : formatNumber(qty);

      const itemNumber = String(
        index + 1
      ).padStart(2, "0");

      lines.push(
        `*${itemNumber} · ${name}*`
      );

      if (code) {
        lines.push(
          `Kode     : ${code}`
        );
      }

      lines.push(
        `Qty      : *${qtyText}*`
      );

      lines.push(
        `Harga    : *Rp ${formatRupiah(
          price
        )}*`
      );

      lines.push(
        `Subtotal : *Rp ${formatRupiah(
          subtotal
        )}*`
      );

      if (index < items.length - 1) {
        lines.push("");
      }
    });
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // TOTAL
  // =======================================================

  lines.push(
    `*TOTAL PENGIRIMAN* : *Rp ${formatRupiah(
      totalValue
    )}*`
  );

  // =======================================================
  // CATATAN
  // =======================================================

  if (remarks) {
    lines.push("");

    lines.push(DIVIDER);

    lines.push("");

    lines.push(
      "> *CATATAN* :"
    );

    lines.push("");

    lines.push(remarks);
  }

  lines.push("");

  lines.push(DIVIDER);

  lines.push("");

  // =======================================================
  // PENUTUP
  // =======================================================

  lines.push(
    "Barang telah diproses untuk pengiriman."
  );

  lines.push(
    "Mohon dilakukan pengecekan barang pada saat diterima."
  );

  lines.push("");

  lines.push(
    "Terima kasih atas kerja sama dan kepercayaannya."
  );

  lines.push("");

  lines.push(
    "*MGB ERP*"
  );

  lines.push(
    "*PT. MITRA GARAM BOGATAMA*"
  );

  lines.push(
    "*Purchase • Inventory • Finance*"
  );

  return lines.join("\n");
}

// =========================================================
// BUILD WHATSAPP SURAT JALAN URL
// =========================================================

export function buildWhatsAppSuratJalanUrl(
  delivery: DeliveryData
): string {
  const message =
    buildWhatsAppSuratJalanMessage(
      delivery
    );

  const encodedMessage =
    encodeURIComponent(message);

  return `https://web.whatsapp.com/send?text=${encodedMessage}`;
}