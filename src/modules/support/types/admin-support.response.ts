import type { SupportRequest, User } from '../../../generated/prisma/client';
import {
  toSupportRequestResponse,
  type SupportRequestResponse,
} from './support.response';

export type AdminSupportStudentSummary = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  region: User['region'];
};

export type AdminSupportRequestResponse = SupportRequestResponse & {
  student: AdminSupportStudentSummary;
};

export type AdminSupportRequestListResponse = {
  requests: AdminSupportRequestResponse[];
};

export const toAdminSupportStudentSummary = (
  user: User,
): AdminSupportStudentSummary => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  region: user.region,
});

export const toAdminSupportRequestResponse = (
  request: SupportRequest & { user: User },
): AdminSupportRequestResponse => ({
  ...toSupportRequestResponse(request),
  student: toAdminSupportStudentSummary(request.user),
});
