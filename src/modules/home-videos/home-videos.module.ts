import { Module } from '@nestjs/common';
import { StorageModule } from '../../lib/storage';
import { AdminHomeVideosController } from './admin-home-videos.controller';
import { AdminHomeVideosService } from './admin-home-videos.service';
import { PublicHomeVideosController } from './public-home-videos.controller';
import { PublicHomeVideosService } from './public-home-videos.service';

@Module({
  imports: [StorageModule],
  controllers: [AdminHomeVideosController, PublicHomeVideosController],
  providers: [AdminHomeVideosService, PublicHomeVideosService],
  exports: [AdminHomeVideosService, PublicHomeVideosService],
})
export class HomeVideosModule {}
