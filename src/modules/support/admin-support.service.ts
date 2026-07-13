import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupportRequestStatus } from '../../generated/prisma/client';
import { MailService } from '../../lib/mail/mail.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  listSupportRequestsQuerySchema,
  replySupportRequestSchema,
  type ListSupportRequestsQueryInput,
  type ReplySupportRequestInput,
} from './schemas/support.schemas';
import {
  toAdminSupportRequestResponse,
  type AdminSupportRequestListResponse,
  type AdminSupportRequestResponse,
} from './types/admin-support.response';

@Injectable()
export class AdminSupportService {
  private readonly logger = new Logger(AdminSupportService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async listRequests(
    query: unknown,
  ): Promise<AdminSupportRequestListResponse> {
    const validatedQuery = this.parseListQuery(query);

    try {
      const requests = await this.prismaService.supportRequest.findMany({
        where: validatedQuery.status
          ? { status: validatedQuery.status }
          : undefined,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      return {
        requests: requests.map(toAdminSupportRequestResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list support requests', error);
      throw error;
    }
  }

  async getRequest(requestId: string): Promise<AdminSupportRequestResponse> {
    const request = await this.requireRequest(requestId);
    return toAdminSupportRequestResponse(request);
  }

  async reply(
    requestId: string,
    input: unknown,
  ): Promise<AdminSupportRequestResponse> {
    const validatedInput = this.parseReplyInput(input);
    const request = await this.requireRequest(requestId);
    this.assertCanReply(request.status);

    try {
      const updated = await this.prismaService.supportRequest.update({
        where: { id: requestId },
        data: {
          adminReply: validatedInput.reply,
          reviewedAt: new Date(),
          status: 'reviewed',
        },
        include: { user: true },
      });

      await this.notifyStudent(updated, validatedInput.reply);

      return toAdminSupportRequestResponse(updated);
    } catch (error) {
      this.logger.error(`Failed to reply to support request ${requestId}`, error);
      throw error;
    }
  }

  async close(requestId: string): Promise<AdminSupportRequestResponse> {
    const request = await this.requireRequest(requestId);
    this.assertCanClose(request.status);

    try {
      const updated = await this.prismaService.supportRequest.update({
        where: { id: requestId },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
        include: { user: true },
      });

      return toAdminSupportRequestResponse(updated);
    } catch (error) {
      this.logger.error(`Failed to close support request ${requestId}`, error);
      throw error;
    }
  }

  private parseListQuery(query: unknown): ListSupportRequestsQueryInput {
    try {
      return listSupportRequestsQuerySchema.parse(query);
    } catch (error) {
      this.logger.error('Failed to validate support request list query', error);
      throw error;
    }
  }

  private parseReplyInput(input: unknown): ReplySupportRequestInput {
    try {
      return replySupportRequestSchema.parse(input);
    } catch (error) {
      this.logger.error('Failed to validate support reply payload', error);
      throw error;
    }
  }

  private assertCanReply(status: SupportRequestStatus): void {
    if (status === 'closed') {
      throw new BadRequestException('Closed support requests cannot be replied to');
    }
  }

  private assertCanClose(status: SupportRequestStatus): void {
    if (status === 'closed') {
      throw new BadRequestException('Support request is already closed');
    }
  }

  private async notifyStudent(
    request: {
      subject: string;
      user: { email: string; fullName: string };
    },
    reply: string,
  ): Promise<void> {
    if (!this.mailService.isEnabled()) {
      return;
    }

    try {
      await this.mailService.sendMail({
        to: request.user.email,
        subject: `Re: ${request.subject}`,
        text: [
          `Hello ${request.user.fullName},`,
          '',
          'Your support request received a reply:',
          '',
          reply,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(
        `Support reply saved but student notification failed for ${request.user.email}`,
        error,
      );
    }
  }

  private async requireRequest(requestId: string) {
    try {
      const request = await this.prismaService.supportRequest.findUnique({
        where: { id: requestId },
        include: { user: true },
      });

      if (!request) {
        throw new NotFoundException('Support request not found');
      }

      return request;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load support request ${requestId}`, error);
      throw error;
    }
  }
}
