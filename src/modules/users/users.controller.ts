import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { ClerkEmail } from '../../common/decorators/clerk-email.decorator';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  type DeleteStudentResponse,
  type StudentListItem,
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

  @ArcjetProtect('user-register')
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
  async listStudents(@Query() query: unknown): Promise<StudentListResponse> {
    try {
      return await this.usersService.listStudents(query);
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
  @ArcjetProtect('admin-mutation')
  @Patch(':userId/deactivate')
  async deactivateStudent(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<StudentListItem> {
    return this.usersService.deactivateStudent(userId);
  }

  @Roles('admin')
  @ArcjetProtect('admin-mutation')
  @Patch(':userId/reactivate')
  async reactivateStudent(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<StudentListItem> {
    return this.usersService.reactivateStudent(userId);
  }

  @Roles('admin')
  @ArcjetProtect('admin-mutation')
  @Delete(':userId')
  async deleteStudent(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<DeleteStudentResponse> {
    return this.usersService.deleteStudent(userId);
  }

  @Roles('admin')
  @Get(':userId')
  async getStudent(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<StudentListItem> {
    return this.usersService.getStudentById(userId);
  }
}
