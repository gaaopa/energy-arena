-- Rename de valor de enum: as linhas com CANCELADA passam a ler INATIVA
-- sem reescrita de tabela (Postgres >= 10).
ALTER TYPE "StatusMatricula" RENAME VALUE 'CANCELADA' TO 'INATIVA';
