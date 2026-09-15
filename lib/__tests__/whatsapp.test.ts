import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeWhatsAppNumber,
  buildPurchaseWhatsAppMessage,
} from "../whatsapp";

describe("WhatsApp Purchase Order", () => {
  it("normalizes Indonesian supplier phone number", () => {
    assert.equal(
      normalizeWhatsAppNumber("0812-3456-7890"),
      "6281234567890"
    );
  });

  it("converts +62 phone number correctly", () => {
    assert.equal(
      normalizeWhatsAppNumber("+62 812 3456 7890"),
      "6281234567890"
    );
  });

  it("builds PO WhatsApp message with supplier, items and total", () => {
    const message = buildPurchaseWhatsAppMessage({
      number: "PO-000123",
      purchaseDate: "2026-08-23T00:00:00.000Z",
      supplier: {
        name: "Supplier ABC",
        phone: "081234567890",
      },
      items: [
        {
          qty: 10,
          price: 15000,
          barang: {
            code: "BRG-001",
            name: "Garam",
            unit: "KG",
          },
        },
      ],
      total: 150000,
    });

    assert.match(message, /PO-000123/);
    assert.match(message, /Supplier ABC/);
    assert.match(message, /Garam/);
    assert.match(message, /10 KG/);
    assert.match(message, /150\.000/);
  });
});
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildWhatsAppPurchaseUrl,
} from "../whatsapp";

describe("WhatsApp Purchase URL", () => {
  it("builds wa.me URL with normalized supplier phone", () => {
    const url = buildWhatsAppPurchaseUrl({
      number: "PO-000123",
      purchaseDate: "2026-08-23T00:00:00.000Z",
      supplier: {
        name: "Supplier ABC",
        phone: "081234567890",
      },
      items: [
        {
          qty: 10,
          price: 15000,
          barang: {
            code: "BRG-001",
            name: "Garam",
            unit: "KG",
          },
        },
      ],
      total: 150000,
    });

    assert.match(
      url,
      /^https:\/\/wa\.me\/6281234567890\?text=/
    );

    assert.match(
      url,
      /PO-000123/
    );
  });

  it("rejects purchase without supplier phone", () => {
    assert.throws(
      () =>
        buildWhatsAppPurchaseUrl({
          number: "PO-000124",
          supplier: {
            name: "Supplier ABC",
            phone: "",
          },
          items: [],
          total: 0,
        }),
      /Nomor WhatsApp supplier belum tersedia/
    );
  });
});
