import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicContentService } from './public-content.service';
import type { PublicCatalogResponse } from './types/public-catalog.response';
import type {
  PublicPreviewLessonDetailResponse,
  PublicPreviewLessonListResponse,
} from './types/public-preview.response';

@Controller('content/public')
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Public()
  @Get('catalog')
  async listCatalog(): Promise<PublicCatalogResponse> {
    return this.publicContentService.listCatalog();
  }

  @Public()
  @Get('preview')
  async listPreviewLessons(): Promise<PublicPreviewLessonListResponse> {
    return this.publicContentService.listPreviewLessons();
  }

  @Public()
  @Get('preview/:lessonId')
  async getPreviewLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<PublicPreviewLessonDetailResponse> {
    return this.publicContentService.getPreviewLesson(lessonId);
  }
}
