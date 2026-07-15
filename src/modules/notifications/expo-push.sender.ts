import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from 'expo-server-sdk';

/**
 * Thin wrapper around `expo-server-sdk` so unit tests can mock push I/O
 * without loading Expo's ESM entry under Jest.
 */
export class ExpoPushSender {
  private readonly expo = new Expo();

  isExpoPushToken(token: unknown): token is string {
    return Expo.isExpoPushToken(token);
  }

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    return this.expo.chunkPushNotifications(messages);
  }

  sendPushNotificationsAsync(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    return this.expo.sendPushNotificationsAsync(messages);
  }
}

export type { ExpoPushMessage, ExpoPushTicket };
