import { Module } from '@nestjs/common';
import { CatracasModule } from '../catracas/catracas.module';
import { MatriculasController } from './matriculas.controller';
import { MatriculasService } from './matriculas.service';

@Module({
  imports: [CatracasModule],
  controllers: [MatriculasController],
  providers: [MatriculasService],
})
export class MatriculasModule {}
