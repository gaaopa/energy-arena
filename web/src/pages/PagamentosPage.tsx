import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  METODO_LABELS,
  PagamentoBaixaModal,
  type MetodoPagamento,
} from '../components/PagamentoBaixaModal';

type StatusPagamento =
  | 'PENDENTE'
  | 'PAGO'
  | 'VENCIDO'
  | 'CANCELADO'
  | 'ESTORNADO';

interface Pagamento {
  id: string;
  valor: number | string; // Decimal do Prisma pode vir serializado como string
  vencimento: string;
  pagoEm?: string | null;
  metodo?: MetodoPagamento | null;
  status: StatusPagamento;
  matricula: {
    id: string;
    aluno: { id: string; nome: string };
    unidade: { id: string; nome: string };
  };
}

interface Unidade {
  id: string;
  nome: string;
  ativo: boolean;
}

const STATUS_LABELS: Record<StatusPagamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
  ESTORNADO: 'Estornado',
};

const STATUS_BADGE: Record<StatusPagamento, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  PAGO: 'bg-emerald-100 text-emerald-800',
  VENCIDO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-zinc-100 text-zinc-600',
  ESTORNADO: 'bg-violet-100 text-violet-800',
};

const STATUS_ORDEM: StatusPagamento[] = [
  'PENDENTE',
  'PAGO',
  'VENCIDO',
  'CANCELADO',
  'ESTORNADO',
];

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function PagamentosPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'' | StatusPagamento>('');
  const [unidadeId, setUnidadeId] = useState('');
  const [baixa, setBaixa] = useState<Pagamento | null>(null);

  // ADMIN (sem unidade vinculada) pode filtrar por unidade;
  // recepção já fica restrita à própria unidade no backend.
  const podeFiltrarUnidade = user?.unidadeId == null;

  const {
    data: pagamentos,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['pagamentos', status, unidadeId],
    queryFn: async () => {
      const res = await api.get<Pagamento[]>('/pagamentos', {
        params: {
          ...(status ? { status } : {}),
          ...(unidadeId ? { unidadeId } : {}),
        },
      });
      return res.data;
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    enabled: podeFiltrarUnidade,
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const resumo = useMemo(() => {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    let totalPendente = 0;
    let totalPagoMes = 0;
    let pagosMes = 0;
    const porStatus: Record<StatusPagamento, number> = {
      PENDENTE: 0,
      PAGO: 0,
      VENCIDO: 0,
      CANCELADO: 0,
      ESTORNADO: 0,
    };

    for (const p of pagamentos ?? []) {
      porStatus[p.status] += 1;
      const valor = Number(p.valor);
      if (p.status === 'PENDENTE') totalPendente += valor;
      if (p.status === 'PAGO' && p.pagoEm) {
        const pagoEm = new Date(p.pagoEm);
        if (
          pagoEm.getMonth() === mesAtual &&
          pagoEm.getFullYear() === anoAtual
        ) {
          totalPagoMes += valor;
          pagosMes += 1;
        }
      }
    }

    return { totalPendente, totalPagoMes, pagosMes, porStatus };
  }, [pagamentos]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function estaVencido(p: Pagamento) {
    return p.status === 'PENDENTE' && new Date(p.vencimento) < hoje;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Pagamentos</h2>
        <div className="flex gap-2">
          {podeFiltrarUnidade && (
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Todas as unidades</option>
              {(unidades ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | StatusPagamento)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total pendente</p>
          <p className="mt-1 text-3xl font-bold">
            {brl.format(resumo.totalPendente)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {resumo.porStatus.PENDENTE} pagamento(s)
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Pago no mês</p>
          <p className="mt-1 text-3xl font-bold">
            {brl.format(resumo.totalPagoMes)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {resumo.pagosMes} baixa(s) em{' '}
            {hoje.toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Por status</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATUS_ORDEM.map((s) => (
              <span
                key={s}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}
              >
                {STATUS_LABELS[s]}: {resumo.porStatus[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Aluno</th>
              <th className="px-5 py-3 font-medium">Unidade</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Vencimento</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Baixa</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(pagamentos ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3">{p.matricula.aluno.nome}</td>
                <td className="px-5 py-3">{p.matricula.unidade.nome}</td>
                <td className="px-5 py-3">{brl.format(Number(p.valor))}</td>
                <td
                  className={`px-5 py-3 ${
                    estaVencido(p) ? 'font-medium text-red-600' : ''
                  }`}
                >
                  {formatarData(p.vencimento)}
                  {estaVencido(p) && (
                    <span className="ml-1 text-xs">(vencido)</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[p.status]}`}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500">
                  {p.status === 'PAGO' && p.pagoEm
                    ? `${formatarData(p.pagoEm)}${
                        p.metodo ? ` · ${METODO_LABELS[p.metodo]}` : ''
                      }`
                    : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  {p.status === 'PENDENTE' && (
                    <button
                      onClick={() => setBaixa(p)}
                      className="rounded-md bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-orange-600"
                    >
                      Baixar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && (
          <p className="px-5 py-4 text-sm text-zinc-500">Carregando...</p>
        )}
        {isError && (
          <p className="px-5 py-4 text-sm text-red-600">
            Erro ao carregar pagamentos.
          </p>
        )}
        {!isPending && pagamentos?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhum pagamento encontrado.
          </p>
        )}
      </div>

      {baixa && (
        <PagamentoBaixaModal
          pagamentoId={baixa.id}
          alunoNome={baixa.matricula.aluno.nome}
          valorFormatado={brl.format(Number(baixa.valor))}
          onClose={() => setBaixa(null)}
        />
      )}
    </div>
  );
}
