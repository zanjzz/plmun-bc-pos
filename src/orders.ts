import { apiRequest } from "./api";
import { requestNotificationRefresh } from "./notifications";

export type OrderStatus =
  | "Pending review"
  | "Confirmed"
  | "Awaiting restock"
  | "Ready for pickup"
  | "Completed"
  | "Cancelled";

export type OnlineOrder = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productId: number;
    name: string;
    quantity: number;
    price: number;
    size: string | null;
    variationId: number | null;
    variationLabel: string | null;
    variationValues: Record<string, string>;
  }>;
  total: number;
  status: OrderStatus;
  statusMessage: string;
  pickupDate: string;
  pickupWindow: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export async function getOrders() {
  return (await apiRequest<{ orders: OnlineOrder[] }>("/orders", {}, true)).orders;
}

export async function createOnlineOrder(input: {
  items: Array<{ productId: number; quantity: number; variationId?: number | null }>;
  pickupDate: string;
  pickupWindow: string;
  notes: string;
}) {
  const order = (
    await apiRequest<{ order: OnlineOrder }>(
      "/orders",
      { method: "POST", body: JSON.stringify(input) },
      true,
    )
  ).order;
  requestNotificationRefresh();
  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus, message?: string) {
  const order = (
    await apiRequest<{ order: OnlineOrder }>(
      `/orders/${id}/status`,
      { method: "PUT", body: JSON.stringify({ status, message }) },
      true,
    )
  ).order;
  requestNotificationRefresh();
  return order;
}

export async function completeWalkInSale(
  items: Array<{ productId: number; variationId?: number | null; quantity: number }>,
) {
  const result = await apiRequest<{
    transaction: { id: string; total: number };
    impactedOrders: OnlineOrder[];
  }>("/pos/checkout", { method: "POST", body: JSON.stringify({ items }) }, true);
  requestNotificationRefresh();
  return result;
}
