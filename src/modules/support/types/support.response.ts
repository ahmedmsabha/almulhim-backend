import type { SupportRequest } from '../../../generated/prisma/client';

export type SupportRequestResponse = {
  id: string;
  subject: string;
  message: string;
  status: SupportRequest['status'];
  adminReply: string | null;
  reviewedAt: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type SupportRequestListResponse = {
  requests: SupportRequestResponse[];
};

export const toSupportRequestResponse = (
  request: SupportRequest,
): SupportRequestResponse => ({
  id: request.id,
  subject: request.subject,
  message: request.message,
  status: request.status,
  adminReply: request.adminReply,
  reviewedAt: request.reviewedAt?.toISOString() ?? null,
  closedAt: request.closedAt?.toISOString() ?? null,
  createdAt: request.createdAt.toISOString(),
});
