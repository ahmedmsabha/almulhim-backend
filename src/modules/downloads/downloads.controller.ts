import {
  Controller,
  Get,
  Head,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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

  /**
   * Proxied video stream for iOS AVPlayer.
   * R2 GetObject-signed URLs return 403 on HEAD; Nest supports HEAD + Range.
   */
  @ArcjetProtect('download-authorize')
  @Get('videos/:lessonVideoId/stream')
  @RequiresDeviceBinding()
  async streamVideoGet(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('lessonVideoId', ParseUUIDPipe) lessonVideoId: string,
    @Headers('range') rangeHeader?: string,
  ): Promise<void> {
    await this.pipeVideoStream(request, response, lessonVideoId, rangeHeader);
  }

  @ArcjetProtect('download-authorize')
  @Head('videos/:lessonVideoId/stream')
  @RequiresDeviceBinding()
  async streamVideoHead(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Param('lessonVideoId', ParseUUIDPipe) lessonVideoId: string,
  ): Promise<void> {
    const access =
      await this.downloadsService.resolveVideoStreamAccessFromRequest(
        request,
        lessonVideoId,
      );
    const meta = this.downloadsService.headVideoMetadata(access);

    response.status(200);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', meta.contentType ?? 'video/mp4');
    if (meta.contentLength != null) {
      response.setHeader('Content-Length', String(meta.contentLength));
    }
    response.end();
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

  private async pipeVideoStream(
    request: AuthenticatedRequest,
    response: Response,
    lessonVideoId: string,
    rangeHeader?: string,
  ): Promise<void> {
    const access =
      await this.downloadsService.resolveVideoStreamAccessFromRequest(
        request,
        lessonVideoId,
      );
    const stream = await this.downloadsService.openVideoStream(
      access,
      rangeHeader,
    );

    response.status(stream.statusCode);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', stream.contentType || 'video/mp4');
    if (stream.contentLength != null) {
      response.setHeader('Content-Length', String(stream.contentLength));
    }
    if (stream.contentRange) {
      response.setHeader('Content-Range', stream.contentRange);
    }

    stream.body.on('error', () => {
      if (!response.headersSent) {
        response.status(500);
      }
      response.end();
    });

    stream.body.pipe(response);
  }
}
