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
import { AdminHomeGalleryService } from './admin-home-gallery.service';
import type {
  AdminHomeGallerySlideListResponse,
  AdminHomeGallerySlideSummaryResponse,
  HomeGalleryImageUrlResponse,
  HomeGalleryImageUploadUrlResponse,
} from './types/admin-home-gallery.response';

@Roles('admin')
@Controller('home-gallery/admin')
export class AdminHomeGalleryController {
  constructor(
    private readonly adminHomeGalleryService: AdminHomeGalleryService,
  ) {}

  @Get()
  async listAll(): Promise<AdminHomeGallerySlideListResponse> {
    return this.adminHomeGalleryService.listAll();
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) slideId: string,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.adminHomeGalleryService.getById(slideId);
  }

  @Get(':id/image-url')
  async getImageUrl(
    @Param('id', ParseUUIDPipe) slideId: string,
  ): Promise<HomeGalleryImageUrlResponse> {
    return this.adminHomeGalleryService.getImageUrl(slideId);
  }

  @ArcjetProtect('admin-mutation')
  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.handleWrite(() => this.adminHomeGalleryService.create(body));
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) slideId: string,
    @Body() body: unknown,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.handleWrite(() =>
      this.adminHomeGalleryService.update(slideId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/publish')
  async publish(
    @Param('id', ParseUUIDPipe) slideId: string,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.adminHomeGalleryService.publish(slideId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/unpublish')
  async unpublish(
    @Param('id', ParseUUIDPipe) slideId: string,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.adminHomeGalleryService.unpublish(slideId);
  }

  @ArcjetProtect('admin-mutation')
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) slideId: string,
  ): Promise<{ deleted: true; id: string }> {
    return this.adminHomeGalleryService.delete(slideId);
  }

  @ArcjetProtect('upload-url')
  @Post(':id/upload-url')
  async createUploadUrl(
    @Param('id', ParseUUIDPipe) slideId: string,
    @Body() body: unknown,
  ): Promise<HomeGalleryImageUploadUrlResponse> {
    return this.handleWrite(() =>
      this.adminHomeGalleryService.createUploadUrl(slideId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch(':id/attach')
  async attachImage(
    @Param('id', ParseUUIDPipe) slideId: string,
    @Body() body: unknown,
  ): Promise<AdminHomeGallerySlideSummaryResponse> {
    return this.handleWrite(() =>
      this.adminHomeGalleryService.attachImage(slideId, body),
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
