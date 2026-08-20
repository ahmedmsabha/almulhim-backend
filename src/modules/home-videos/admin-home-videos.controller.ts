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
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminHomeVideosService } from './admin-home-videos.service';
import type {
  AdminHomeVideoListResponse,
  AdminHomeVideoSummaryResponse,
  HomeVideoPlaybackUrlResponse,
  HomeVideoUploadUrlResponse,
} from './types/admin-home-video.response';

@Roles('admin')
@Controller('home-videos/admin')
export class AdminHomeVideosController {
  constructor(
    private readonly adminHomeVideosService: AdminHomeVideosService,
  ) {}

  @Get()
  async listAll(): Promise<AdminHomeVideoListResponse> {
    return this.adminHomeVideosService.listAll();
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.adminHomeVideosService.getById(homeVideoId);
  }

  @Get(':id/playback-url')
  async getPlaybackUrl(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
  ): Promise<HomeVideoPlaybackUrlResponse> {
    return this.adminHomeVideosService.getPlaybackUrl(homeVideoId);
  }

  @ArcjetProtect('admin-mutation')
  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.handleWrite(() => this.adminHomeVideosService.create(body));
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
    @Body() body: unknown,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.handleWrite(() =>
      this.adminHomeVideosService.update(homeVideoId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/publish')
  async publish(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.adminHomeVideosService.publish(homeVideoId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/unpublish')
  async unpublish(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.adminHomeVideosService.unpublish(homeVideoId);
  }

  @ArcjetProtect('admin-mutation')
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
  ): Promise<{ deleted: true; id: string }> {
    return this.adminHomeVideosService.delete(homeVideoId);
  }

  @ArcjetProtect('upload-url')
  @Post(':id/upload-url')
  async createUploadUrl(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
    @Body() body: unknown,
  ): Promise<HomeVideoUploadUrlResponse> {
    return this.handleWrite(() =>
      this.adminHomeVideosService.createUploadUrl(homeVideoId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/attach')
  async attachVideo(
    @Param('id', ParseUUIDPipe) homeVideoId: string,
    @Body() body: unknown,
  ): Promise<AdminHomeVideoSummaryResponse> {
    return this.handleWrite(() =>
      this.adminHomeVideosService.attachVideo(homeVideoId, body),
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
