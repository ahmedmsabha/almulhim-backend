export const ANALYTICS_EVENTS = {
  SUBSCRIPTION_SUBMITTED: 'subscription_submitted',
  SUBSCRIPTION_APPROVED: 'subscription_approved',
  SUBSCRIPTION_REJECTED: 'subscription_rejected',
  SUBSCRIPTION_SUSPENDED: 'subscription_suspended',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  USER_REGISTERED: 'user_registered',
  LESSON_PUBLISHED: 'lesson_published',
  ANNOUNCEMENT_PUBLISHED: 'announcement_published',
  DEVICE_BOUND: 'device_bound',
  DEVICE_RESET: 'device_reset',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
