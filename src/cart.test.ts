import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredCart } from "./cart.ts";

test("restores valid simple and variation cart lines", () => {
  const cart = parseStoredCart(
    JSON.stringify({
      "4:standard": {
        productId: 4,
        variationId: null,
        variationValues: {},
        variationLabel: null,
        unitPrice: 25,
        quantity: 2,
      },
      "7:12": {
        productId: 7,
        variationId: 12,
        variationValues: { Size: "M" },
        variationLabel: "M",
        unitPrice: 350,
        quantity: 1,
      },
    }),
  );
  assert.equal(Object.keys(cart).length, 2);
  assert.equal(cart["7:12"].variationValues.Size, "M");
});

test("rejects malformed or non-positive cart lines", () => {
  const cart = parseStoredCart(
    JSON.stringify({
      valid: {
        productId: 1,
        variationId: null,
        variationValues: {},
        variationLabel: null,
        unitPrice: 10,
        quantity: 1,
      },
      invalid: {
        productId: 2,
        variationId: null,
        variationValues: {},
        variationLabel: null,
        unitPrice: 10,
        quantity: 0,
      },
    }),
  );
  assert.deepEqual(Object.keys(cart), ["valid"]);
  assert.deepEqual(parseStoredCart("not-json"), {});
});
