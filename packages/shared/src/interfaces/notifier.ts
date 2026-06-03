export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  delivered: boolean;
  channel: string;
  error?: string;
}

export interface Notifier {
  send(notification: NotificationPayload): Promise<NotificationResult>;
  sendBulk(notifications: NotificationPayload[]): Promise<NotificationResult[]>;
}
