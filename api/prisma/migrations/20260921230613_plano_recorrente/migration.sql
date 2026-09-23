-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "proximaRenovacao" TIMESTAMP(3),
ALTER COLUMN "dataFim" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Plano" ADD COLUMN     "recorrente" BOOLEAN NOT NULL DEFAULT false;

