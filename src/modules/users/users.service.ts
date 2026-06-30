import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../../lib/database/prisma.service';
import {
  registerUserSchema,
  type RegisterUserInput,
} from './schemas/register-user.schema';
import {
  toUserProfileResponse,
  type StudentListResponse,
  type UserProfileResponse,
} from './types/user-profile.response';

export type RegisterUserParams = {
  clerkId: string;
  email: string;
  input: unknown;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getCurrentUser(clerkId: string): Promise<UserProfileResponse> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { clerkId },
      });

      if (!user) {
        throw new NotFoundException('User is not registered');
      }

      return toUserProfileResponse(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
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
        throw new ConflictException('User is already registered');
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

      return toUserProfileResponse(user);
    } catch (error) {
      if (error instanceof ConflictException) {
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

  async listStudents(): Promise<StudentListResponse> {
    try {
      const students = await this.prismaService.user.findMany({
        where: { role: 'student' },
        orderBy: { createdAt: 'desc' },
      });

      return {
        students: students.map(toUserProfileResponse),
      };
    } catch (error) {
      this.logger.error('Failed to list students', error);
      throw error;
    }
  }
}
