import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { RequiresDeviceBinding } from '../../common/decorators/requires-device-binding.decorator';
import { RequiresRegistration } from '../../common/decorators/requires-registration.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { DownloadsService } from './downloads.service';
import type {
  PdfViewAuthorizeResponse,
  VideoDownloadAuthorizeResponse,
  VideoDownloadListResponse,
} from './types/download.response';

@Controller('downloads')
@RequiresRegistration({ studentOnly: true })
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @ArcjetProtect('download-authorize')
  @Post('videos/:lessonVideoId/authorize')
  @RequiresDeviceBinding()
  async authorizeVideoDownload(
    @Req() request: AuthenticatedRequest,
    @Param('lessonVideoId', ParseUUIDPipe) lessonVideoId: string,
  ): Promise<VideoDownloadAuthorizeResponse> {
    return this.downloadsService.authorizeVideoDownloadFromRequest(
      request,
      lessonVideoId,
    );
  }

  @ArcjetProtect('download-authorize')
  @Post('pdfs/:lessonPdfId/authorize')
  @RequiresDeviceBinding()
  async authorizePdfView(
    @Req() request: AuthenticatedRequest,
    @Param('lessonPdfId', ParseUUIDPipe) lessonPdfId: string,
  ): Promise<PdfViewAuthorizeResponse> {
    return this.downloadsService.authorizePdfViewFromRequest(
      request,
      lessonPdfId,
    );
  }

  @Get('me')
  @RequiresDeviceBinding()
  async listMyDownloads(
    @Req() request: AuthenticatedRequest,
  ): Promise<VideoDownloadListResponse> {
    return this.downloadsService.listMyDownloadsFromRequest(request);
  }
}
