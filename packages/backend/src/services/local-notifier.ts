import {
  Notifier,
  NotificationPayload,
  NotificationResult,
} from '@mentamind/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Local stub implementation of Notifier.
 * Logs notifications to console and creates entries in the Notification table.
 */
export class LocalNotifier implements Notifier {
  async send(notification: NotificationPayload): Promise<NotificationResult> {
    const channel = notification.channel ?? 'IN_APP';

    console.log(
      `[LOCAL-NOTIFIER] ──────────────────────────────────\n` +
        `  To:      ${notification.userId}\n` +
        `  Channel: ${channel}\n` +
        `  Type:    ${notification.type}\n` +
        `  Title:   ${notification.title}\n` +
        `  Message: ${notification.message}\n` +
        `───────────────────────────────────────────────────`,
    );

    try {
      await prisma.notification.create({
        data: {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: false,
        },
      });

      return {
        delivered: true,
        channel,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[LOCAL-NOTIFIER] Failed to persist notification: ${errorMessage}`,
      );

      return {
        delivered: false,
        channel,
        error: errorMessage,
      };
    }
  }

  async sendBulk(
    notifications: NotificationPayload[],
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const notification of notifications) {
      const result = await this.send(notification);
      results.push(result);
    }

    return results;
  }
}
