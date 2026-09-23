import { PeriodoPlano } from '@prisma/client';

// Duração de um ciclo de cobrança por período de plano.
export const PERIODO_MESES: Record<PeriodoPlano, number> = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};
