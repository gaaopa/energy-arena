-- AlterEnum
ALTER TYPE "MetodoCheckIn" ADD VALUE 'FACIAL';

-- AlterTable
ALTER TABLE "Aluno" ADD COLUMN     "catracaId" INTEGER,
ADD COLUMN     "consentimentoBiometriaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CatracaDispositivo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatracaDispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatracaEvento" (
    "id" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "alunoId" TEXT,
    "tipo" TEXT NOT NULL,
    "aceito" BOOLEAN NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatracaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatracaDispositivo_token_key" ON "CatracaDispositivo"("token");

-- CreateIndex
CREATE INDEX "CatracaEvento_dispositivoId_criadoEm_idx" ON "CatracaEvento"("dispositivoId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_catracaId_key" ON "Aluno"("catracaId");

-- AddForeignKey
ALTER TABLE "CatracaDispositivo" ADD CONSTRAINT "CatracaDispositivo_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatracaEvento" ADD CONSTRAINT "CatracaEvento_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "CatracaDispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatracaEvento" ADD CONSTRAINT "CatracaEvento_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

