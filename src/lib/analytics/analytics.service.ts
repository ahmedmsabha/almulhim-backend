import { Injectable } from '@nestjs/common';
import { PostHogService } from '../posthog/posthog.service';
import { ANALYTICS_EVENTS } from './analytics.events';
import type {
  AnnouncementPublishedProperties,
  DeviceBoundProperties,
  DeviceResetProperties,
  LessonPublishedProperties,
  SubscriptionApprovedProperties,
  SubscriptionExpiredProperties,
  SubscriptionRejectedProperties,
  SubscriptionSubmittedProperties,
  SubscriptionSuspendedProperties,
  UserRegisteredProperties,
} from './analytics.types';

@Injectable()
export class AnalyticsService {
  constructor(private readonly postHogService: PostHogService) {}

  captureSubscriptionSubmitted(
    userId: string,
    properties: SubscriptionSubmittedProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.SUBSCRIPTION_SUBMITTED,
      properties,
    );
  }

  captureSubscriptionApproved(
    userId: string,
    properties: SubscriptionApprovedProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.SUBSCRIPTION_APPROVED,
      properties,
    );
  }

  captureSubscriptionRejected(
    userId: string,
    properties: SubscriptionRejectedProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.SUBSCRIPTION_REJECTED,
      properties,
    );
  }

  captureSubscriptionSuspended(
    userId: string,
    properties: SubscriptionSuspendedProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.SUBSCRIPTION_SUSPENDED,
      properties,
    );
  }

  captureSubscriptionExpired(
    userId: string,
    properties: SubscriptionExpiredProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.SUBSCRIPTION_EXPIRED,
      properties,
    );
  }

  captureUserRegistered(
    userId: string,
    properties: UserRegisteredProperties,
  ): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.USER_REGISTERED,
      properties,
    );
  }

  captureLessonPublished(
    adminClerkId: string,
    properties: LessonPublishedProperties,
  ): void {
    this.postHogService.capture(
      adminClerkId,
      ANALYTICS_EVENTS.LESSON_PUBLISHED,
      properties,
    );
  }

  captureAnnouncementPublished(
    adminClerkId: string,
    properties: AnnouncementPublishedProperties,
  ): void {
    this.postHogService.capture(
      adminClerkId,
      ANALYTICS_EVENTS.ANNOUNCEMENT_PUBLISHED,
      properties,
    );
  }

  captureDeviceBound(userId: string, properties: DeviceBoundProperties): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.DEVICE_BOUND,
      properties,
    );
  }

  captureDeviceReset(userId: string, properties: DeviceResetProperties): void {
    this.postHogService.capture(
      userId,
      ANALYTICS_EVENTS.DEVICE_RESET,
      properties,
    );
  }
}
