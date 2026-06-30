import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ClerkEmail } from '../../common/decorators/clerk-email.decorator';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  type StudentListResponse,
  type UserProfileResponse,
} from './types/user-profile.response';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(
    @ClerkUserId() clerkUserId: string,
  ): Promise<UserProfileResponse> {
    return this.usersService.getCurrentUser(clerkUserId);
  }

  @Post('register')
  async registerUser(
    @ClerkUserId() clerkUserId: string,
    @ClerkEmail() clerkEmail: string,
    @Body() body: unknown,
  ): Promise<UserProfileResponse> {
    try {
      return await this.usersService.registerUser({
        clerkId: clerkUserId,
        email: clerkEmail,
        input: body,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.flatten(),
        });
      }

      throw error;
    }
  }

  @Roles('admin')
  @Get()
  async listStudents(): Promise<StudentListResponse> {
    return this.usersService.listStudents();
  }
}
