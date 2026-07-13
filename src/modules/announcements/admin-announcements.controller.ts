import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { AdminAnnouncementsService } from './admin-announcements.service';
import type {
  AdminAnnouncementListResponse,
  AdminAnnouncementSummaryResponse,
  ImageUploadUrlResponse,
} from './types/admin-announcement.response';

@Roles('admin')
@Controller('announcements/admin')
export class AdminAnnouncementsController {
  constructor(
    private readonly adminAnnouncementsService: AdminAnnouncementsService,
  ) {}

  @Get()
  async listAll(): Promise<AdminAnnouncementListResponse> {
    return this.adminAnnouncementsService.listAll();
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) announcementId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.adminAnnouncementsService.getById(announcementId);
  }

  @ArcjetProtect('admin-mutation')
  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.handleWrite(() => this.adminAnnouncementsService.create(body));
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) announcementId: string,
    @Body() body: unknown,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.handleWrite(() =>
      this.adminAnnouncementsService.update(announcementId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/publish')
  async publish(
    @Param('id', ParseUUIDPipe) announcementId: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.adminAnnouncementsService.publish(announcementId, adminClerkId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/unpublish')
  async unpublish(
    @Param('id', ParseUUIDPipe) announcementId: string,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.adminAnnouncementsService.unpublish(announcementId);
  }

  @ArcjetProtect('upload-url')
  @Post(':id/image-upload-url')
  async createImageUploadUrl(
    @Param('id', ParseUUIDPipe) announcementId: string,
    @Body() body: unknown,
  ): Promise<ImageUploadUrlResponse> {
    return this.handleWrite(() =>
      this.adminAnnouncementsService.createImageUploadUrl(announcementId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/attach-image')
  async attachImage(
    @Param('id', ParseUUIDPipe) announcementId: string,
    @Body() body: unknown,
  ): Promise<AdminAnnouncementSummaryResponse> {
    return this.handleWrite(() =>
      this.adminAnnouncementsService.attachImage(announcementId, body),
    );
  }

  private async handleWrite<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
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
}
