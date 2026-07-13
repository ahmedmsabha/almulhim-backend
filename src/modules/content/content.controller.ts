import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { User } from '../../generated/prisma/client';
import { ContentService } from './content.service';
import type {
  ChapterDetailResponse,
  ContentSearchResponse,
  ContentTreeResponse,
  LessonDetailResponse,
  UnitDetailResponse,
  UnitListResponse,
} from './types/content.response';

@Controller('content')
@RequiresRegistration({ studentOnly: true })
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /**
   * Shared content search for Admin Web, Student Web, and Mobile.
   * Method-level @RequiresRegistration() clears studentOnly so admins are allowed.
   * Clients send already-authorized flattened items; matching is not an access-control boundary.
   */
  @RequiresRegistration()
  @ArcjetProtect('content-search')
  @Post('search')
  async search(@Body() body: unknown): Promise<ContentSearchResponse> {
    try {
      return await this.contentService.search(body);
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

  @Get('tree')
  async getTree(@CurrentUser() user: User): Promise<ContentTreeResponse> {
    return this.contentService.getTree(user);
  }

  @Get('units')
  async listUnits(@CurrentUser() user: User): Promise<UnitListResponse> {
    return this.contentService.listUnits(user);
  }

  @Get('units/:id')
  async getUnit(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) unitId: string,
  ): Promise<UnitDetailResponse> {
    return this.contentService.getUnit(user, unitId);
  }

  @Get('chapters/:id')
  async getChapter(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) chapterId: string,
  ): Promise<ChapterDetailResponse> {
    return this.contentService.getChapter(user, chapterId);
  }

  @Get('lessons/:id')
  async getLesson(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) lessonId: string,
  ): Promise<LessonDetailResponse> {
    return this.contentService.getLesson(user, lessonId);
  }
}
