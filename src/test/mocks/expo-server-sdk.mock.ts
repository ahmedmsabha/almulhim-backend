export type ExpoPushMessage = {
  to: string | string[];
  title?: string;
  body?: string;
  sound?: string | null;
  data?: Record<string, unknown>;
  channelId?: string;
};

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error';
      message: string;
      details?: { error?: string; expoPushToken?: string };
    };

export class Expo {
  static isExpoPushToken(token: unknown): token is string {
    return typeof token === 'string' && token.startsWith('ExponentPushToken[');
  }

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    return [messages];
  }

  sendPushNotificationsAsync(
    _messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    return Promise.resolve([]);
  }
}

export default Expo;
