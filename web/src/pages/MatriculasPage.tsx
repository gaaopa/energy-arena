import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { MatriculaForm } from '../components/MatriculaForm';
import { PERIODO_LABEL, type Periodo } from '../components/PlanoForm';

type StatusMatricula = 'ATIVA' | 'CANCELADA' | 'VENCIDA' | 'SUSPENSA';

interface Matricula {
  id: string;
  dataInicio: string;
  dataFim: string;
  valor: number | string;
  status: StatusMatricula;
  aluno: { id: string; nome: string };
  plano: { id: string; nome: string; periodo: Periodo };
  unidade: { id: string; nome: string };
}

interface Unidade {
  id: string;
  nome: string;
}

const STATUS_LABEL: Record<StatusMatricula, string> = {
  ATIVA: 'Ativa',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
  SUSPENSA: 'Suspensa',
};

const STATUS_BADGE: Record<StatusMatricula, string> = {
  ATIVA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-red-100 text-red-700',
  VENCIDA: 'bg-amber-100 text-amber-700',
  SUSPENSA: 'bg-zinc-200 text-zinc-600',
};

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// Datas chegam como 'YYYY-MM-DD' (ou ISO); montar a data em horário local
// evita o deslocamento de fuso que new Date(iso) aplicaria.
function formatData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export function MatriculasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusMatricula | ''>('');
  const [unidadeFiltro, setUnidadeFiltro] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const {
    data: matriculas,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['matriculas', status, unidadeFiltro],
    queryFn: async () =>
      (
        await api.get<Matricula[]>('/matriculas', {
          params: {
            ...(status ? { status } : {}),
            ...(unidadeFiltro ? { unidadeId: unidadeFiltro } : {}),
          },
        })
      ).data,
  });

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
    enabled: !user?.unidadeId,
  });

  const cancelar = useMutation({
    mutationFn: async (id: string) =>
      api.patch(`/matriculas/${id}/cancelar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matriculas'] });
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const msg = axiosErr.response?.data?.message;
      setErro(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Erro ao cancelar matrícula.'),
      );
    },
  });

  function confirmarCancelamento(m: Matricula) {
    if (
      window.confirm(
        `Cancelar a matrícula de ${m.aluno.nome} (${m.plano.nome})?`,
      )
    ) {
      setErro(null);
      cancelar.mutate(m.id);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Matrículas</h2>
        <button
          onClick={() => setFormAberto(true)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Nova matrícula
        </button>
      </div>
      <div className="mb-4 flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusMatricula | '')}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as StatusMatricula[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {!user?.unidadeId && (
          <select
            value={unidadeFiltro}
            onChange={(e) => setUnidadeFiltro(e.target.value)}
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
      </div>
      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Aluno</th>
              <th className="px-5 py-3 font-medium">Plano</th>
              <th className="px-5 py-3 font-medium">Unidade</th>
              <th className="px-5 py-3 font-medium">Início</th>
              <th className="px-5 py-3 font-medium">Fim</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(matriculas ?? []).map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3 font-medium">{m.aluno.nome}</td>
                <td className="px-5 py-3">
                  {m.plano.nome}
                  <span className="block text-xs text-zinc-500">
                    {PERIODO_LABEL[m.plano.periodo]}
                  </span>
                </td>
                <td className="px-5 py-3">{m.unidade.nome}</td>
                <td className="px-5 py-3">{formatData(m.dataInicio)}</td>
                <td className="px-5 py-3">{formatData(m.dataFim)}</td>
                <td className="px-5 py-3">{brl.format(Number(m.valor))}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[m.status]}`}
                  >
                    {STATUS_LABEL[m.status]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {m.status === 'ATIVA' && (
                    <button
                      onClick={() => confirmarCancelamento(m)}
                      disabled={cancelar.isPending}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Cancelar
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
            Erro ao carregar matrículas.
          </p>
        )}
        {!isPending && matriculas?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhuma matrícula encontrada.
          </p>
        )}
      </div>
      {formAberto && <MatriculaForm onClose={() => setFormAberto(false)} />}
    </div>
  );
}
