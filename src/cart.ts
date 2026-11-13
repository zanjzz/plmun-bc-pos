export type CartLine = {
  productId: number;
  variationId: number | null;
  variationValues: Record<string, string>;
  variationLabel: string | null;
  unitPrice: number;
  quantity: number;
};

export type Cart = Record<string, CartLine>;

const cartKey = (userId: string) => `plmun-bc-cart:${userId}`;

export function parseStoredCart(raw: string | null): Cart {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, CartLine] => {
        const [, line] = entry as [string, Partial<CartLine>];
        return (
          Number.isInteger(line.productId) &&
          Number(line.productId) > 0 &&
          (line.variationId === null || Number.isInteger(line.variationId)) &&
          typeof line.variationValues === "object" &&
          line.variationValues !== null &&
          !Array.isArray(line.variationValues) &&
          Object.values(line.variationValues).every((item) => typeof item === "string") &&
          (line.variationLabel === null || typeof line.variationLabel === "string") &&
          Number.isFinite(line.unitPrice) &&
          Number(line.unitPrice) >= 0 &&
          Number.isInteger(line.quantity) &&
          Number(line.quantity) > 0
        );
      }),
    );
  } catch {
    return {};
  }
}

export function loadStoredCart(userId: string): Cart {
  try {
    return parseStoredCart(window.localStorage.getItem(cartKey(userId)));
  } catch {
    return {};
  }
}

export function saveStoredCart(userId: string, cart: Cart) {
  try {
    window.localStorage.setItem(cartKey(userId), JSON.stringify(cart));
  } catch {
    // Storage failure should never block ordering or signing out.
  }
}
