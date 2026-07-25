import type { SupportRequest } from '../../../generated/prisma/client';
import {
  parseSupportMessage,
  type SupportFollowUp,
} from '../support-thread';

export type SupportRequestResponse = {
  id: string;
  subject: string;
  message: string;
  followUps: SupportFollowUp[];
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
): SupportRequestResponse => {
  const parsed = parseSupportMessage(request.message);

  return {
    id: request.id,
    subject: request.subject,
    message: parsed.message,
    followUps: parsed.followUps,
    status: request.status,
    adminReply: request.adminReply,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    closedAt: request.closedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
  };
};
