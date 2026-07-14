import { apiFetch } from "./client";

export interface NotificationResponse {
  id: string;
  category: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export async function fetchNotifications(
  unreadOnly: boolean = false,
  limit: number = 20
): Promise<NotificationResponse[]> {
  const query = new URLSearchParams({
    unread_only: unreadOnly.toString(),
    limit: limit.toString(),
  }).toString();
  const response = await apiFetch(`/me/notifications?${query}`);
  if (!response.ok) throw new Error("Failed to fetch notifications");
  return response.json();
}

export async function markNotificationRead(
  notificationId: string
): Promise<NotificationResponse> {
  const response = await apiFetch(`/me/notifications/${notificationId}/read`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to mark notification read");
  return response.json();
}
