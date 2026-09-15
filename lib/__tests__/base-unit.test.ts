import assert from "node:assert/strict";
import test from "node:test";
import { fromBaseQty, normalizeBarangUnit, toBaseQty } from "../base-unit";

test("converts one main unit to base quantity", () => {
  assert.equal(toBaseQty(10, 24), 240);
});

test("converts base quantity back to legacy stock unit", () => {
  assert.equal(fromBaseQty(60, 24), 2.5);
});

test("invalid conversion safely falls back to one", () => {
  assert.equal(toBaseQty(10, 0), 10);
  assert.equal(fromBaseQty(10, Number.NaN), 10);
});

test("normalizes missing base unit without changing main unit", () => {
  assert.deepEqual(
    normalizeBarangUnit({ unit: "PCS", baseUnit: null, conversionRate: 1 }),
    { unit: "PCS", baseUnit: "PCS", conversionRate: 1 },
  );
});
