import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Prisma, User } from '../../generated/prisma/client';
import { AnalyticsService } from '../../lib/analytics/analytics.service';
import { ClerkService } from '../../lib/clerk/clerk.service';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  listStudentsQuerySchema,
  type ListStudentsQueryInput,
  type StudentSubscriptionStatus,
} from './schemas/list-students-query.schema';
import {
  registerUserSchema,
  type RegisterUserInput,
} from './schemas/register-user.schema';
import {
  toStudentListItem,
  toUserProfileResponse,
  type DeleteStudentResponse,
  type StudentListItem,
  type StudentListResponse,
  type UserProfileResponse,
} from './types/user-profile.response';

export type RegisterUserParams = {
  clerkId: string;
  email: string;
  input: unknown;
};

const STUDENT_OWNED_INCLUDE = {
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { status: true },
  },
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly clerkService: ClerkService,
  ) {}

  async getCurrentUser(clerkId: string): Promise<UserProfileResponse> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        throw new NotFoundException('User is not registered');
      }

      this.assertNotDeactivated(user);

      return toUserProfileResponse(user);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(`Failed to load current user for clerkId ${clerkId}`, error);
      throw error;
    }
  }

  async registerUser(params: RegisterUserParams): Promise<UserProfileResponse> {
    let input: RegisterUserInput;

    try {
      input = registerUserSchema.parse(params.input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate register user payload', error);
      throw error;
    }

    try {
      const existingUser = await this.prismaService.user.findUnique({
        where: { clerkId: params.clerkId },
      });

      if (existingUser) {
        this.assertNotDeactivated(existingUser);

        const user = await this.prismaService.user.update({
          where: { clerkId: params.clerkId },
          data: {
            email: params.email,
            fullName: input.fullName,
            phoneNumber: input.phoneNumber,
            telegramUsername: input.telegramUsername,
            region: input.region,
          },
        });

        return toUserProfileResponse(user);
      }

      const user = await this.prismaService.user.create({
        data: {
          clerkId: params.clerkId,
          email: params.email,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          telegramUsername: input.telegramUsername,
          region: input.region,
          role: 'student',
        },
      });

      this.analyticsService.captureUserRegistered(user.id, {
        region: user.region,
      });

      return toUserProfileResponse(user);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already registered');
      }

      this.logger.error(
        `Failed to register user for clerkId ${params.clerkId}`,
        error,
      );
      throw error;
    }
  }

  async listStudents(query: unknown = {}): Promise<StudentListResponse> {
    const validatedQuery = this.parseListStudentsQuery(query);

    try {
      const where = await this.buildStudentListWhere(validatedQuery);
      const skip = (validatedQuery.page - 1) * validatedQuery.pageSize;

      const [total, students] = await Promise.all([
        this.prismaService.user.count({ where }),
        this.prismaService.user.findMany({
          where,
          include: STUDENT_OWNED_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip,
          take: validatedQuery.pageSize,
        }),
      ]);

      return {
        students: students.map(toStudentListItem),
        total,
        page: validatedQuery.page,
        pageSize: validatedQuery.pageSize,
      };
    } catch (error) {
      this.logger.error('Failed to list students', error);
      throw error;
    }
  }

  async getStudentById(userId: string): Promise<StudentListItem> {
    try {
      const user = await this.requireStudentWithLatestSubscription(userId);
      return toStudentListItem(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load student ${userId}`, error);
      throw error;
    }
  }

  /**
   * Soft-block a student: set `deactivatedAt`, then ban the linked Clerk user.
   * Fail-closed — if Clerk ban fails, Nest `deactivatedAt` is rolled back.
   */
  async deactivateStudent(userId: string): Promise<StudentListItem> {
    const student = await this.requireStudent(userId);

    if (student.deactivatedAt !== null) {
      return this.getStudentById(userId);
    }

    const deactivatedAt = new Date();

    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { deactivatedAt },
      });
    } catch (error) {
      this.logger.error(`Failed to deactivate Nest student ${userId}`, error);
      throw error;
    }

    try {
      await this.clerkService.banUser(student.clerkId);
    } catch (error) {
      try {
        await this.prismaService.user.update({
          where: { id: userId },
          data: { deactivatedAt: null },
        });
      } catch (rollbackError) {
        this.logger.error(
          `Failed to roll back deactivatedAt for student ${userId} after Clerk ban failure (clerkId=${student.clerkId})`,
          rollbackError,
        );
      }

      this.logger.error(
        `Clerk ban failed for student ${userId} (clerkId=${student.clerkId}); Nest deactivation rolled back`,
        error,
      );
      throw new BadGatewayException(
        'Failed to ban Clerk user; student was not deactivated',
      );
    }

    return this.getStudentById(userId);
  }

  /**
   * Clear soft-block: unban Clerk first, then clear Nest `deactivatedAt`.
   * Fail-closed — Nest stays deactivated if Clerk unban fails.
   */
  async reactivateStudent(userId: string): Promise<StudentListItem> {
    const student = await this.requireStudent(userId);

    if (student.deactivatedAt === null) {
      return this.getStudentById(userId);
    }

    try {
      await this.clerkService.unbanUser(student.clerkId);
    } catch (error) {
      this.logger.error(
        `Clerk unban failed for student ${userId} (clerkId=${student.clerkId}); Nest remains deactivated`,
        error,
      );
      throw new BadGatewayException(
        'Failed to unban Clerk user; student remains deactivated',
      );
    }

    try {
      await this.prismaService.user.update({
        where: { id: userId },
        data: { deactivatedAt: null },
      });
    } catch (error) {
      this.logger.error(
        `Nest reactivate failed after Clerk unban for student ${userId} (clerkId=${student.clerkId}) — Clerk is unbanned; clear deactivatedAt manually`,
        error,
      );
      throw new BadGatewayException(
        'Clerk user was unbanned but Nest reactivation failed; clear deactivatedAt manually',
      );
    }

    return this.getStudentById(userId);
  }

  /**
   * Hard-delete Nest student (cascade: subscriptions, device bindings,
   * support requests, video downloads) then delete the Clerk user.
   * If Nest succeeds and Clerk fails → 502; do not recreate Nest row.
   */
  async deleteStudent(userId: string): Promise<DeleteStudentResponse> {
    const student = await this.requireStudent(userId);
    const { clerkId } = student;

    try {
      await this.prismaService.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      this.logger.error(`Failed to delete Nest student ${userId}`, error);
      throw error;
    }

    try {
      await this.clerkService.deleteUser(clerkId);
    } catch (error) {
      this.logger.error(
        `Nest student ${userId} deleted but Clerk delete failed (clerkId=${clerkId}) — manual Clerk cleanup required`,
        error,
      );
      throw new BadGatewayException(
        `Student deleted locally but Clerk user deletion failed (clerkId=${clerkId}); manual cleanup required`,
      );
    }

    return { deleted: true, userId };
  }

  private assertNotDeactivated(user: User): void {
    if (user.deactivatedAt !== null) {
      throw new ForbiddenException('Student account is deactivated');
    }
  }

  private async requireStudent(userId: string): Promise<User> {
    try {
      const user = await this.prismaService.user.findFirst({
        where: {
          id: userId,
          role: 'student',
        },
      });

      if (!user) {
        throw new NotFoundException('Student not found');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to load student ${userId}`, error);
      throw error;
    }
  }

  private async requireStudentWithLatestSubscription(userId: string) {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        role: 'student',
      },
      include: STUDENT_OWNED_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException('Student not found');
    }

    return user;
  }

  private parseListStudentsQuery(query: unknown): ListStudentsQueryInput {
    try {
      return listStudentsQuerySchema.parse(query);
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      this.logger.error('Failed to validate list students query', error);
      throw error;
    }
  }

  private async buildStudentListWhere(
    query: ListStudentsQueryInput,
  ): Promise<Prisma.UserWhereInput> {
    const where: Prisma.UserWhereInput = {
      role: 'student',
    };

    if (!query.includeDeactivated) {
      where.deactivatedAt = null;
    }

    if (query.region) {
      where.region = query.region;
    }

    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { phoneNumber: { contains: query.q, mode: 'insensitive' } },
        { telegramUsername: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.status === 'free') {
      where.subscriptions = { none: {} };
      return where;
    }

    if (query.status) {
      const userIds = await this.findStudentIdsByLatestSubscriptionStatus(
        query.status,
        query.includeDeactivated,
      );

      where.id = { in: userIds };
    }

    return where;
  }

  /**
   * Students whose most recent subscription row has the given status.
   * Used for non-`free` status filters so older closed rows do not match.
   */
  private async findStudentIdsByLatestSubscriptionStatus(
    status: Exclude<StudentSubscriptionStatus, 'free'>,
    includeDeactivated: boolean,
  ): Promise<string[]> {
    try {
      if (includeDeactivated) {
        const rows = await this.prismaService.$queryRaw<{ id: string }[]>`
          SELECT u.id
          FROM users u
          INNER JOIN LATERAL (
            SELECT s.status
            FROM subscriptions s
            WHERE s.user_id = u.id
            ORDER BY s.created_at DESC
            LIMIT 1
          ) AS latest ON TRUE
          WHERE u.role = 'student'::"UserRole"
            AND latest.status = ${status}::"SubscriptionStatus"
        `;

        return rows.map((row) => row.id);
      }

      const rows = await this.prismaService.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        INNER JOIN LATERAL (
          SELECT s.status
          FROM subscriptions s
          WHERE s.user_id = u.id
          ORDER BY s.created_at DESC
          LIMIT 1
        ) AS latest ON TRUE
        WHERE u.role = 'student'::"UserRole"
          AND u.deactivated_at IS NULL
          AND latest.status = ${status}::"SubscriptionStatus"
      `;

      return rows.map((row) => row.id);
    } catch (error) {
      this.logger.error(
        `Failed to resolve student ids for subscription status ${status}`,
        error,
      );
      throw error;
    }
  }
}
