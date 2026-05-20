import { api } from "@/lib/api";

export type DashboardNotification = {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  link: string | null;
  module: string | null;
  metadata: Record<string, unknown> | null;
};

export type NotificationUnreadCount = {
  unread_count: number;
};

export async function fetchNotifications(params?: {
  unreadOnly?: boolean;
  type?: string;
  limit?: number;
  skip?: number;
}) {
  const search = new URLSearchParams();
  if (params?.unreadOnly) search.set("unread_only", "true");
  if (params?.type) search.set("type", params.type);
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (typeof params?.skip === "number") search.set("skip", String(params.skip));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return api.get<DashboardNotification[]>(`/notifications${suffix}`);
}

export function fetchUnreadNotificationCount() {
  return api.get<NotificationUnreadCount>("/notifications/unread-count");
}

export function markNotificationRead(notificationId: string) {
  return api.patch<DashboardNotification>(`/notifications/${notificationId}/read`);
}

export function markAllNotificationsRead() {
  return api.patch<NotificationUnreadCount>("/notifications/mark-all-read");
}
