export type StatusAluno = 'ATIVO' | 'INATIVO' | 'SUSPENSO';
export type StatusMatricula = 'ATIVA' | 'CANCELADA' | 'VENCIDA' | 'SUSPENSA';

interface BadgeConfig {
  label: string;
  classes: string;
}

const STATUS_ALUNO: Record<StatusAluno, BadgeConfig> = {
  ATIVO: { label: 'Ativo', classes: 'bg-emerald-100 text-emerald-700' },
  INATIVO: { label: 'Inativo', classes: 'bg-zinc-200 text-zinc-600' },
  SUSPENSO: { label: 'Suspenso', classes: 'bg-amber-100 text-amber-700' },
};

const STATUS_MATRICULA: Record<StatusMatricula, BadgeConfig> = {
  ATIVA: { label: 'Ativa', classes: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', classes: 'bg-zinc-200 text-zinc-600' },
  VENCIDA: { label: 'Vencida', classes: 'bg-red-100 text-red-700' },
  SUSPENSA: { label: 'Suspensa', classes: 'bg-amber-100 text-amber-700' },
};

function Badge({ config }: { config: BadgeConfig }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  );
}

export function StatusAlunoBadge({ status }: { status: StatusAluno }) {
  return <Badge config={STATUS_ALUNO[status]} />;
}

export function StatusMatriculaBadge({ status }: { status: StatusMatricula }) {
  return <Badge config={STATUS_MATRICULA[status]} />;
}
