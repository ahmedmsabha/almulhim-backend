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
import { ClerkUserId } from '../../common/decorators/clerk-user-id.decorator';
import { AdminContentService } from './admin-content.service';
import type {
  AdminChapterDetailResponse,
  AdminContentTreeResponse,
  AdminLessonDetailResponse,
  AdminPdfResponse,
  AdminUnitDetailResponse,
  AdminUnitSummaryResponse,
  AdminVideoResponse,
  MediaUploadUrlResponse,
  MediaViewUrlResponse,
} from './types/admin-content.response';

@Roles('admin')
@Controller('content/admin')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Get('tree')
  async getTree(): Promise<AdminContentTreeResponse> {
    return this.adminContentService.getTree();
  }

  @Get('units/:id')
  async getUnit(
    @Param('id', ParseUUIDPipe) unitId: string,
  ): Promise<AdminUnitDetailResponse> {
    return this.adminContentService.getUnit(unitId);
  }

  @Get('chapters/:id')
  async getChapter(
    @Param('id', ParseUUIDPipe) chapterId: string,
  ): Promise<AdminChapterDetailResponse> {
    return this.adminContentService.getChapter(chapterId);
  }

  @Get('lessons/:id')
  async getLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
  ): Promise<AdminLessonDetailResponse> {
    return this.adminContentService.getLesson(lessonId);
  }

  @ArcjetProtect('admin-mutation')
  @Post('units')
  async createUnit(@Body() body: unknown): Promise<AdminUnitSummaryResponse> {
    return this.handleWrite(() => this.adminContentService.createUnit(body));
  }

  @ArcjetProtect('admin-mutation')
  @Patch('units/:id')
  async updateUnit(
    @Param('id', ParseUUIDPipe) unitId: string,
    @Body() body: unknown,
  ): Promise<AdminUnitSummaryResponse> {
    return this.handleWrite(() =>
      this.adminContentService.updateUnit(unitId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('units/:id/publish')
  async publishUnit(
    @Param('id', ParseUUIDPipe) unitId: string,
  ): Promise<AdminUnitSummaryResponse> {
    return this.adminContentService.publishUnit(unitId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('units/:id/unpublish')
  async unpublishUnit(
    @Param('id', ParseUUIDPipe) unitId: string,
  ): Promise<AdminUnitSummaryResponse> {
    return this.adminContentService.unpublishUnit(unitId);
  }

  @ArcjetProtect('admin-mutation')
  @Post('units/:unitId/chapters')
  async createChapter(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() body: unknown,
  ): Promise<AdminChapterDetailResponse> {
    return this.handleWrite(() =>
      this.adminContentService.createChapter(unitId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('chapters/:id')
  async updateChapter(
    @Param('id', ParseUUIDPipe) chapterId: string,
    @Body() body: unknown,
  ): Promise<AdminChapterDetailResponse> {
    return this.handleWrite(() =>
      this.adminContentService.updateChapter(chapterId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('chapters/:id/publish')
  async publishChapter(
    @Param('id', ParseUUIDPipe) chapterId: string,
  ): Promise<AdminChapterDetailResponse> {
    return this.adminContentService.publishChapter(chapterId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('chapters/:id/unpublish')
  async unpublishChapter(
    @Param('id', ParseUUIDPipe) chapterId: string,
  ): Promise<AdminChapterDetailResponse> {
    return this.adminContentService.unpublishChapter(chapterId);
  }

  @ArcjetProtect('admin-mutation')
  @Post('chapters/:chapterId/lessons')
  async createLesson(
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() body: unknown,
  ): Promise<AdminLessonDetailResponse> {
    return this.handleWrite(() =>
      this.adminContentService.createLesson(chapterId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('lessons/:id')
  async updateLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Body() body: unknown,
  ): Promise<AdminLessonDetailResponse> {
    return this.handleWrite(() =>
      this.adminContentService.updateLesson(lessonId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Patch('lessons/:id/publish')
  async publishLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
    @ClerkUserId() adminClerkId: string,
  ): Promise<AdminLessonDetailResponse> {
    return this.adminContentService.publishLesson(lessonId, adminClerkId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('lessons/:id/unpublish')
  async unpublishLesson(
    @Param('id', ParseUUIDPipe) lessonId: string,
  ): Promise<AdminLessonDetailResponse> {
    return this.adminContentService.unpublishLesson(lessonId);
  }

  @ArcjetProtect('upload-url')
  @Post('lessons/:lessonId/videos/upload-url')
  async createVideoUploadUrl(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() body: unknown,
  ): Promise<MediaUploadUrlResponse> {
    return this.handleWrite(() =>
      this.adminContentService.createVideoUploadUrl(lessonId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Post('lessons/:lessonId/videos')
  async attachVideo(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() body: unknown,
  ): Promise<AdminVideoResponse> {
    return this.handleWrite(() =>
      this.adminContentService.attachVideo(lessonId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Get('videos/:id/playback-url')
  async getVideoPlaybackUrl(
    @Param('id', ParseUUIDPipe) videoId: string,
  ): Promise<MediaViewUrlResponse> {
    return this.adminContentService.getVideoPlaybackUrl(videoId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('videos/:id')
  async updateVideo(
    @Param('id', ParseUUIDPipe) videoId: string,
    @Body() body: unknown,
  ): Promise<AdminVideoResponse> {
    return this.handleWrite(() =>
      this.adminContentService.updateVideo(videoId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Delete('videos/:id')
  async deleteVideo(
    @Param('id', ParseUUIDPipe) videoId: string,
  ): Promise<{ deleted: true; id: string }> {
    return this.adminContentService.deleteVideo(videoId);
  }

  @ArcjetProtect('upload-url')
  @Post('lessons/:lessonId/pdfs/upload-url')
  async createPdfUploadUrl(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() body: unknown,
  ): Promise<MediaUploadUrlResponse> {
    return this.handleWrite(() =>
      this.adminContentService.createPdfUploadUrl(lessonId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Post('lessons/:lessonId/pdfs')
  async attachPdf(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() body: unknown,
  ): Promise<AdminPdfResponse> {
    return this.handleWrite(() =>
      this.adminContentService.attachPdf(lessonId, body),
    );
  }

  @Get('pdfs/:id/view-url')
  async getPdfViewUrl(
    @Param('id', ParseUUIDPipe) pdfId: string,
  ): Promise<MediaViewUrlResponse> {
    return this.adminContentService.getPdfViewUrl(pdfId);
  }

  @ArcjetProtect('admin-mutation')
  @Patch('pdfs/:id')
  async updatePdf(
    @Param('id', ParseUUIDPipe) pdfId: string,
    @Body() body: unknown,
  ): Promise<AdminPdfResponse> {
    return this.handleWrite(() =>
      this.adminContentService.updatePdf(pdfId, body),
    );
  }

  @ArcjetProtect('admin-mutation')
  @Delete('pdfs/:id')
  async deletePdf(
    @Param('id', ParseUUIDPipe) pdfId: string,
  ): Promise<{ deleted: true; id: string }> {
    return this.adminContentService.deletePdf(pdfId);
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