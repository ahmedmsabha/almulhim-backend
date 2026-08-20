import { Controller, Get } from '@nestjs/common';
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
}
