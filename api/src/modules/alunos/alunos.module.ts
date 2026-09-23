import { Module } from '@nestjs/common';
import { CatracasModule } from '../catracas/catracas.module';
import { AlunosController } from './alunos.controller';
import { AlunosService } from './alunos.service';

@Module({
  imports: [CatracasModule],
  controllers: [AlunosController],
  providers: [AlunosService],
})
export class AlunosModule {}
