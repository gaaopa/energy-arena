-- Consentimento de biometria deixou de ser checkbox e passa a nascer da
-- matrícula (decisão do dono, 2026-09-22). Quem já se matriculou recebe a
-- marca agora; aluno sem matrícula segue sem consentimento.
UPDATE "Aluno" a
SET "consentimentoBiometriaEm" = now()
WHERE a."consentimentoBiometriaEm" IS NULL
  AND EXISTS (SELECT 1 FROM "Matricula" m WHERE m."alunoId" = a."id");
