import type { User } from '../../../generated/prisma/client';

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

export type StudentListResponse = {
  students: UserProfileResponse[];
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
