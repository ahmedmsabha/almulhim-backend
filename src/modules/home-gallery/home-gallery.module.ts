import { Module } from '@nestjs/common';
import { StorageModule } from '../../lib/storage';
import { AdminHomeGalleryController } from './admin-home-gallery.controller';
import { AdminHomeGalleryService } from './admin-home-gallery.service';
import { PublicHomeGalleryController } from './public-home-gallery.controller';
import { PublicHomeGalleryService } from './public-home-gallery.service';

@Module({
  imports: [StorageModule],
  controllers: [AdminHomeGalleryController, PublicHomeGalleryController],
  providers: [AdminHomeGalleryService, PublicHomeGalleryService],
  exports: [AdminHomeGalleryService, PublicHomeGalleryService],
})
export class HomeGalleryModule {}
