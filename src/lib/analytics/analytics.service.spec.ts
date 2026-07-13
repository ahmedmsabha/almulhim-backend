jest.mock('../posthog/posthog.service', () => ({
  PostHogService: class MockPostHogService {
    capture = jest.fn();
  },
}));

import { PostHogService } from '../posthog/posthog.service';
import { ANALYTICS_EVENTS } from './analytics.events';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let postHogService: PostHogService;

  beforeEach(() => {
    postHogService = new PostHogService({} as never);
    analyticsService = new AnalyticsService(postHogService);
    jest.clearAllMocks();
  });

  it('delegates subscription lifecycle events to PostHog', () => {
    analyticsService.captureSubscriptionSubmitted('user-1', {
      subscriptionId: 'sub-1',
      planId: 'plan-1',
      status: 'pending_review',
    });

    expect(postHogService.capture).toHaveBeenCalledWith(
      'user-1',
      ANALYTICS_EVENTS.SUBSCRIPTION_SUBMITTED,
      {
        subscriptionId: 'sub-1',
        planId: 'plan-1',
        status: 'pending_review',
      },
    );
  });

  it('uses admin clerk id for lesson published events', () => {
    analyticsService.captureLessonPublished('admin_clerk_1', {
      lessonId: 'lesson-1',
      chapterId: 'chapter-1',
      unitId: 'unit-1',
    });

    expect(postHogService.capture).toHaveBeenCalledWith(
      'admin_clerk_1',
      ANALYTICS_EVENTS.LESSON_PUBLISHED,
      {
        lessonId: 'lesson-1',
        chapterId: 'chapter-1',
        unitId: 'unit-1',
      },
    );
  });
});
