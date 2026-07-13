import type {
  SubscriptionStatus,
  User,
} from '../../../generated/prisma/client';
import type { StudentSubscriptionStatus } from '../schemas/list-students-query.schema';

export type UserProfileResponse = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  telegramUsername: string;
  region: User['region'];
  role: User['role'];
  createdAt: string;
  updatedAt: string;
};

/**
 * Admin students directory row.
 * Contact fields use Admin Web names: `phone` / `telegram`
 * (mapped from `phoneNumber` / `telegramUsername`).
 *
 * `deactivatedAt` is null when the student is active (product access allowed).
 */
export type StudentListItem = {
  id: string;
  clerkId: string;
  fullName: string;
  email: string;
  phone: string;
  telegram: string;
  region: User['region'];
  subscriptionStatus: StudentSubscriptionStatus;
  deactivatedAt: string | null;
};

export type StudentListResponse = {
  students: StudentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StudentWithLatestSubscription = User & {
  subscriptions: Array<{ status: SubscriptionStatus }>;
};

export const toUserProfileResponse = (user: User): UserProfileResponse => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  telegramUsername: user.telegramUsername,
  region: user.region,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const deriveStudentSubscriptionStatus = (
  subscriptions: Array<{ status: SubscriptionStatus }>,
): StudentSubscriptionStatus => subscriptions[0]?.status ?? 'free';

export const toStudentListItem = (
  user: StudentWithLatestSubscription,
): StudentListItem => ({
  id: user.id,
  clerkId: user.clerkId,
  fullName: user.fullName,
  email: user.email,
  phone: user.phoneNumber,
  telegram: user.telegramUsername,
  region: user.region,
  subscriptionStatus: deriveStudentSubscriptionStatus(user.subscriptions),
  deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
});

export type DeleteStudentResponse = {
  deleted: true;
  userId: string;
};
