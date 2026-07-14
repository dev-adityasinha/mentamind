import { client } from "./client";

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
  const response = await client.get("/me/notifications", {
    params: {
      unread_only: unreadOnly,
      limit,
    },
  });
  return response.data;
}

export async function markNotificationRead(
  notificationId: string
): Promise<NotificationResponse> {
  const response = await client.post(`/me/notifications/${notificationId}/read`);
  return response.data;
}
