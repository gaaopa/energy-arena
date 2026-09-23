import { Module } from '@nestjs/common';
import { CheckInsModule } from '../checkins/checkins.module';
import { CatracasController } from './catracas.controller';
import { CatracasService } from './catracas.service';

@Module({
  imports: [CheckInsModule],
  controllers: [CatracasController],
  providers: [CatracasService],
  exports: [CatracasService],
})
export class CatracasModule {}
