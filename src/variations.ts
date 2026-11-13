export type ProductAttribute = {
  id: string;
  name: string;
  values: string[];
};

export type VariationValues = Record<string, string>;

export type ProductVariation = {
  id?: number;
  updatedAt?: string;
  key: string;
  values: VariationValues;
  sku: string;
  price: number;
  stock: number;
  active: boolean;
  image: string | null;
};

export function variationKey(values: VariationValues) {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name.trim().toLowerCase()}=${value.trim().toLowerCase()}`)
    .join("|");
}

export function variationLabel(values: VariationValues) {
  return Object.values(values).filter(Boolean).join(" / ");
}

export function isOptionValueAvailable(
  variations: ProductVariation[],
  selected: VariationValues,
  attributeName: string,
  value: string,
) {
  const available = variations.filter((variation) => variation.active && variation.stock > 0);
  const otherSelections = Object.entries(selected).filter(
    ([name, selectedValue]) => name !== attributeName && selectedValue,
  );
  const contextual = available.some(
    (variation) =>
      variation.values[attributeName] === value &&
      otherSelections.every(([name, selectedValue]) => variation.values[name] === selectedValue),
  );
  if (contextual) return true;
  const currentContextExists = available.some((variation) =>
    otherSelections.every(([name, selectedValue]) => variation.values[name] === selectedValue),
  );
  return (
    !currentContextExists &&
    available.some((variation) => variation.values[attributeName] === value)
  );
}

export function generateVariationValues(attributes: ProductAttribute[]): VariationValues[] {
  const usable = attributes
    .map((attribute) => ({
      name: attribute.name.trim(),
      values: [...new Set(attribute.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((attribute) => attribute.name && attribute.values.length);
  if (!usable.length) return [];
  return usable.reduce<VariationValues[]>(
    (combinations, attribute) =>
      combinations.flatMap((combination) =>
        attribute.values.map((value) => ({ ...combination, [attribute.name]: value })),
      ),
    [{}],
  );
}

export function mergeGeneratedVariations(
  attributes: ProductAttribute[],
  existing: ProductVariation[],
  defaults: { price: number; stock: number },
) {
  const byKey = new Map(existing.map((variation) => [variation.key, variation]));
  return generateVariationValues(attributes).map((values) => {
    const key = variationKey(values);
    return (
      byKey.get(key) ?? {
        key,
        values,
        sku: "",
        price: defaults.price,
        stock: defaults.stock,
        active: true,
        image: null,
      }
    );
  });
}
