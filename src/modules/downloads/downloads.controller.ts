import {
  Controller,
  Get,
  Head,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ArcjetProtect } from '../../common/decorators/arcjet-protect.decorator';
import { Public } from '../../common/decorators/public.decorator';
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
   * Auth via short-lived `ticket` query param (AVPlayer cannot reliably send Bearer headers).
   */
  @Public()
  @ArcjetProtect('download-authorize')
  @Get('videos/:lessonVideoId/stream')
  async streamVideoGet(
    @Res() response: Response,
    @Param('lessonVideoId', ParseUUIDPipe) lessonVideoId: string,
    @Query('ticket') ticket: string | undefined,
    @Headers('range') rangeHeader?: string,
  ): Promise<void> {
    if (!ticket) {
      throw new UnauthorizedException('Missing stream ticket');
    }
    await this.pipeVideoStream(response, lessonVideoId, ticket, rangeHeader);
  }

  @Public()
  @ArcjetProtect('download-authorize')
  @Head('videos/:lessonVideoId/stream')
  async streamVideoHead(
    @Res() response: Response,
    @Param('lessonVideoId', ParseUUIDPipe) lessonVideoId: string,
    @Query('ticket') ticket: string | undefined,
  ): Promise<void> {
    if (!ticket) {
      throw new UnauthorizedException('Missing stream ticket');
    }

    const access =
      await this.downloadsService.resolveVideoStreamAccessFromTicket(
        ticket,
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
    response: Response,
    lessonVideoId: string,
    ticket: string,
    rangeHeader?: string,
  ): Promise<void> {
    const access =
      await this.downloadsService.resolveVideoStreamAccessFromTicket(
        ticket,
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
