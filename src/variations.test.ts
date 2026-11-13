import assert from "node:assert/strict";
import test from "node:test";
import {
  generateVariationValues,
  isOptionValueAvailable,
  mergeGeneratedVariations,
  variationKey,
} from "./variations.ts";

test("generates only configured variation combinations", () => {
  const combinations = generateVariationValues([
    { id: "size", name: "Size", values: ["S", "M"] },
    { id: "color", name: "Color", values: ["Blue", "Red"] },
  ]);
  assert.equal(combinations.length, 4);
  assert.deepEqual(combinations[0], { Size: "S", Color: "Blue" });
});

test("deduplicates repeated attribute values", () => {
  const combinations = generateVariationValues([
    { id: "size", name: "Size", values: ["M", "M", " L "] },
  ]);
  assert.deepEqual(combinations, [{ Size: "M" }, { Size: "L" }]);
});

test("keeps edits when regenerating the same combination", () => {
  const values = { Size: "M" };
  const existing = {
    id: 8,
    key: variationKey(values),
    values,
    sku: "UNI-M",
    price: 275,
    stock: 12,
    active: true,
    image: null,
  };
  const generated = mergeGeneratedVariations(
    [{ id: "size", name: "Size", values: ["M", "L"] }],
    [existing],
    { price: 250, stock: 0 },
  );
  assert.equal(generated[0], existing);
  assert.equal(generated[1].price, 250);
});

test("disables out-of-stock options in the current combination", () => {
  const variations = [
    {
      key: "blue-s",
      values: { Color: "Blue", Size: "S" },
      sku: "",
      price: 1,
      stock: 0,
      active: true,
      image: null,
    },
    {
      key: "red-s",
      values: { Color: "Red", Size: "S" },
      sku: "",
      price: 1,
      stock: 2,
      active: true,
      image: null,
    },
  ];
  assert.equal(
    isOptionValueAvailable(variations, { Color: "Blue", Size: "S" }, "Color", "Blue"),
    false,
  );
  assert.equal(
    isOptionValueAvailable(variations, { Color: "Blue", Size: "S" }, "Color", "Red"),
    true,
  );
});

test("allows escaping a combination with no available alternatives", () => {
  const variations = [
    {
      key: "blue-m",
      values: { Color: "Blue", Size: "M" },
      sku: "",
      price: 1,
      stock: 3,
      active: true,
      image: null,
    },
  ];
  assert.equal(
    isOptionValueAvailable(variations, { Color: "Red", Size: "S" }, "Color", "Blue"),
    true,
  );
});
