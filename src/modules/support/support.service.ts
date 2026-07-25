import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '../../generated/prisma/client';
import type { AppEnv } from '../../config/env.schema';
import { MailService } from '../../lib/mail/mail.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  createSupportRequestSchema,
  followUpSupportRequestSchema,
  type CreateSupportRequestInput,
  type FollowUpSupportRequestInput,
} from './schemas/support.schemas';
import {
  appendSupportFollowUp,
  parseSupportMessage,
} from './support-thread';
import {
  toSupportRequestResponse,
  type SupportRequestListResponse,
  type SupportRequestResponse,
} from './types/support.response';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async create(user: User, input: unknown): Promise<SupportRequestResponse> {
    const validatedInput = this.parseCreateInput(input);

    try {
      const request = await this.prismaService.supportRequest.create({
        data: {
          userId: user.id,
          subject: validatedInput.subject,
          message: validatedInput.message,
        },
      });

      await this.notifyTeacher(user, request, validatedInput);

      return toSupportRequestResponse(request);
    } catch (error) {
      this.logger.error(
        `Failed to create support request for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async listMine(user: User): Promise<SupportRequestListResponse> {
    try {
      const requests = await this.prismaService.supportRequest.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      return {
        requests: requests.map(toSupportRequestResponse),
      };
    } catch (error) {
      this.logger.error(
        `Failed to list support requests for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  async followUp(
    user: User,
    requestId: string,
    input: unknown,
  ): Promise<SupportRequestResponse> {
    const validatedInput = this.parseFollowUpInput(input);

    const request = await this.prismaService.supportRequest.findFirst({
      where: { id: requestId, userId: user.id },
    });

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    if (request.status === 'closed') {
      throw new BadRequestException(
        'Closed support requests cannot receive follow-ups',
      );
    }

    try {
      const updated = await this.prismaService.supportRequest.update({
        where: { id: requestId },
        data: {
          message: appendSupportFollowUp(
            request.message,
            validatedInput.message,
          ),
          status: 'open',
        },
      });

      await this.notifyTeacherFollowUp(user, updated, validatedInput);

      return toSupportRequestResponse(updated);
    } catch (error) {
      this.logger.error(
        `Failed to append follow-up for support request ${requestId}`,
        error,
      );
      throw error;
    }
  }

  private parseCreateInput(input: unknown): CreateSupportRequestInput {
    try {
      return createSupportRequestSchema.parse(input);
    } catch (error) {
      this.logger.error(
        'Failed to validate create support request payload',
        error,
      );
      throw error;
    }
  }

  private parseFollowUpInput(input: unknown): FollowUpSupportRequestInput {
    try {
      return followUpSupportRequestSchema.parse(input);
    } catch (error) {
      this.logger.error(
        'Failed to validate support follow-up payload',
        error,
      );
      throw error;
    }
  }

  private async notifyTeacher(
    user: User,
    request: { id: string },
    input: CreateSupportRequestInput,
  ): Promise<void> {
    const teacherEmail = this.configService.get('TEACHER_SUPPORT_EMAIL', {
      infer: true,
    });

    if (!teacherEmail || !this.mailService.isEnabled()) {
      return;
    }

    try {
      await this.mailService.sendMail({
        to: teacherEmail,
        subject: `New support request from ${user.fullName}`,
        text: [
          'A new support request was submitted.',
          '',
          `Request ID: ${request.id}`,
          `Student: ${user.fullName}`,
          `Email: ${user.email}`,
          `Phone: ${user.phoneNumber}`,
          `Region: ${user.region}`,
          '',
          `Subject: ${input.subject}`,
          '',
          input.message,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(
        `Support request ${request.id} saved but teacher notification failed`,
        error,
      );
    }
  }

  private async notifyTeacherFollowUp(
    user: User,
    request: { id: string; subject: string; message: string },
    input: FollowUpSupportRequestInput,
  ): Promise<void> {
    const teacherEmail = this.configService.get('TEACHER_SUPPORT_EMAIL', {
      infer: true,
    });

    if (!teacherEmail || !this.mailService.isEnabled()) {
      return;
    }

    const parsed = parseSupportMessage(request.message);

    try {
      await this.mailService.sendMail({
        to: teacherEmail,
        subject: `Follow-up on support request from ${user.fullName}`,
        text: [
          'A student added a follow-up to an existing support request.',
          '',
          `Request ID: ${request.id}`,
          `Student: ${user.fullName}`,
          `Email: ${user.email}`,
          `Phone: ${user.phoneNumber}`,
          '',
          `Subject: ${request.subject}`,
          '',
          'Original message:',
          parsed.message,
          '',
          'Latest follow-up:',
          input.message,
        ].join('\n'),
      });
    } catch (error) {
      this.logger.error(
        `Support follow-up ${request.id} saved but teacher notification failed`,
        error,
      );
    }
  }
}
