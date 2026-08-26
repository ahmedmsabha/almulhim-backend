import {
  Controller,
  Get,
  Head,
  Headers,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PublicHomeVideosService } from './public-home-videos.service';
import type { PublicHomeVideoListResponse } from './types/public-home-video.response';

@Controller('home-videos/public')
export class PublicHomeVideosController {
  constructor(
    private readonly publicHomeVideosService: PublicHomeVideosService,
  ) {}

  @Public()
  @Get()
  async listPublished(): Promise<PublicHomeVideoListResponse> {
    return this.publicHomeVideosService.listPublished();
  }

  /**
   * Public Range stream so browsers and iOS AVPlayer can start before the
   * full file is downloaded. R2 signed GET URLs reject HEAD, which stalls
   * native players until the whole object is fetched.
   */
  @Public()
  @Get(':homeVideoId/stream')
  async streamGet(
    @Res() response: Response,
    @Param('homeVideoId', ParseUUIDPipe) homeVideoId: string,
    @Headers('range') rangeHeader?: string,
  ): Promise<void> {
    await this.pipeStream(response, homeVideoId, rangeHeader);
  }

  @Public()
  @Head(':homeVideoId/stream')
  async streamHead(
    @Res() response: Response,
    @Param('homeVideoId', ParseUUIDPipe) homeVideoId: string,
  ): Promise<void> {
    const access =
      await this.publicHomeVideosService.resolvePublishedStreamAccess(
        homeVideoId,
      );
    const meta = this.publicHomeVideosService.headVideoMetadata(access);

    response.status(200);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', meta.contentType ?? 'video/mp4');
    response.setHeader('Cache-Control', 'no-store');
    if (meta.contentLength != null) {
      response.setHeader('Content-Length', String(meta.contentLength));
    }
    response.end();
  }

  private async pipeStream(
    response: Response,
    homeVideoId: string,
    rangeHeader?: string,
  ): Promise<void> {
    const access =
      await this.publicHomeVideosService.resolvePublishedStreamAccess(
        homeVideoId,
      );
    const stream = await this.publicHomeVideosService.openVideoStream(
      access,
      rangeHeader,
    );

    response.status(stream.statusCode);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader(
      'Content-Type',
      stream.contentType ?? access.contentType ?? 'video/mp4',
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
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
