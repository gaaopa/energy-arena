import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { UnidadesModule } from './modules/unidades/unidades.module';
import { AlunosModule } from './modules/alunos/alunos.module';
import { PlanosModule } from './modules/planos/planos.module';
import { MatriculasModule } from './modules/matriculas/matriculas.module';
import { PagamentosModule } from './modules/pagamentos/pagamentos.module';
import { CheckInsModule } from './modules/checkins/checkins.module';
import { CatracasModule } from './modules/catracas/catracas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    UnidadesModule,
    AlunosModule,
    PlanosModule,
    MatriculasModule,
    PagamentosModule,
    CheckInsModule,
    CatracasModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
