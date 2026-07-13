import type { ContentRegion, DeviceType } from '../../generated/prisma/client';

export type SubscriptionSubmittedProperties = {
  subscriptionId: string;
  planId: string;
  status: string;
};

export type SubscriptionApprovedProperties = {
  subscriptionId: string;
  userId: string;
  adminClerkId: string;
};

export type SubscriptionRejectedProperties = {
  subscriptionId: string;
  userId: string;
  adminClerkId: string;
};

export type SubscriptionSuspendedProperties = {
  subscriptionId: string;
  userId: string;
  adminClerkId: string;
};

export type SubscriptionExpiredProperties = {
  subscriptionId: string;
  planId: string;
};

export type UserRegisteredProperties = {
  region: ContentRegion;
};

export type LessonPublishedProperties = {
  lessonId: string;
  chapterId: string;
  unitId: string;
};

export type AnnouncementPublishedProperties = {
  announcementId: string;
  region: ContentRegion;
};

export type DeviceBoundProperties = {
  deviceType: DeviceType;
};

export type DeviceResetProperties = {
  deviceType: DeviceType | 'all';
  adminClerkId: string;
};
