import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublicHomeGalleryService } from './public-home-gallery.service';
import type { PublicHomeGalleryListResponse } from './types/public-home-gallery.response';

@Controller('home-gallery/public')
export class PublicHomeGalleryController {
  constructor(
    private readonly publicHomeGalleryService: PublicHomeGalleryService,
  ) {}

  @Public()
  @Get()
  async listPublished(): Promise<PublicHomeGalleryListResponse> {
    return this.publicHomeGalleryService.listPublished();
  }
}
