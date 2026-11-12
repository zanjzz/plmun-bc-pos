import { apiRequest } from "./api";

export type NotificationType = "order" | "inventory" | "transaction" | "system";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionPage: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications() {
  return apiRequest<{ notifications: AppNotification[]; unreadCount: number }>(
    "/notifications",
    {},
    true,
  );
}

export async function markNotificationRead(id: string) {
  return (
    await apiRequest<{ notification: AppNotification }>(
      `/notifications/${id}/read`,
      { method: "PUT" },
      true,
    )
  ).notification;
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>("/notifications/read-all", { method: "PUT" }, true);
}

export function requestNotificationRefresh() {
  window.dispatchEvent(new Event("notifications:refresh"));
}
