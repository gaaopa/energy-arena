import { useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { AlunoForm } from '../components/AlunoForm';
import {
  StatusAlunoBadge,
  StatusMatriculaBadge,
  type StatusAluno,
  type StatusMatricula,
} from '../components/AlunoStatusBadge';

type PeriodoPlano = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

interface Matricula {
  id: string;
  status: StatusMatricula;
  dataInicio: string;
  dataFim: string;
  valor: number | string;
  plano: {
    id: string;
    nome: string;
    periodo: PeriodoPlano;
    multiUnidade: boolean;
  };
}

interface AlunoDetalhe {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  status: StatusAluno;
  unidadeId: string;
  unidade: { id: string; nome: string };
  matriculas: Matricula[];
}

interface Plano {
  id: string;
  nome: string;
  valor: number | string;
  periodo: PeriodoPlano;
  multiUnidade: boolean;
  ativo: boolean;
}

interface CheckIn {
  id: string;
  criadoEm: string;
  metodo: 'MANUAL' | 'QR_CODE';
  unidade: { id: string; nome: string };
}

const PERIODO_LABEL: Record<PeriodoPlano, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarMoeda(valor: number | string): string {
  const n = Number(valor);
  return Number.isNaN(n) ? '—' : moeda.format(n);
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Campos de data (nascimento, início/fim de matrícula) são gravados como
// UTC — sem timeZone o pt-BR (UTC-3) exibiria o dia anterior.
function formatarData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function extrairMensagemErro(err: unknown, fallback: string): string {
  const msg = (err as AxiosError<{ message?: string | string[] }>).response
    ?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

export function AlunoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const alunoId = id ?? '';
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [novaMatriculaAberta, setNovaMatriculaAberta] = useState(false);
  const [planoId, setPlanoId] = useState('');
  const [dataInicio, setDataInicio] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [erroMatricula, setErroMatricula] = useState<string | null>(null);

  const {
    data: aluno,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['alunos', alunoId],
    enabled: !!alunoId,
    queryFn: async () =>
      (await api.get<AlunoDetalhe>(`/alunos/${alunoId}`)).data,
  });

  const { data: planos } = useQuery({
    queryKey: ['planos'],
    queryFn: async () => (await api.get<Plano[]>('/planos')).data,
  });

  const { data: checkins } = useQuery({
    queryKey: ['checkins', 'aluno', alunoId],
    enabled: !!alunoId,
    queryFn: async () =>
      (
        await api.get<CheckIn[]>('/checkins', {
          params: { alunoId },
        })
      ).data,
  });

  const criarMatricula = useMutation({
    mutationFn: async (unidadeId: string) =>
      api.post('/matriculas', { alunoId, planoId, unidadeId, dataInicio }),
    onSuccess: () => {
      setNovaMatriculaAberta(false);
      setPlanoId('');
      setErroMatricula(null);
      void queryClient.invalidateQueries({ queryKey: ['alunos', alunoId] });
    },
    onError: (err) =>
      setErroMatricula(
        extrairMensagemErro(err, 'Erro ao criar matrícula.'),
      ),
  });

  const cancelarMatricula = useMutation({
    mutationFn: async (matriculaId: string) =>
      api.patch(`/matriculas/${matriculaId}/cancelar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alunos', alunoId] });
    },
    onError: (err) =>
      setErroMatricula(
        extrairMensagemErro(err, 'Erro ao cancelar matrícula.'),
      ),
  });

  function submitMatricula(e: FormEvent) {
    e.preventDefault();
    if (criarMatricula.isPending || !aluno) return;
    if (!planoId) {
      setErroMatricula('Selecione um plano.');
      return;
    }
    setErroMatricula(null);
    criarMatricula.mutate(aluno.unidadeId);
  }

  function confirmarCancelamento(matriculaId: string) {
    if (
      window.confirm(
        'Cancelar esta matrícula? Cobranças pendentes também serão canceladas.',
      )
    ) {
      setErroMatricula(null);
      cancelarMatricula.mutate(matriculaId);
    }
  }

  if (!alunoId) return <Navigate to="/alunos" replace />;

  if (isPending) {
    return <p className="text-sm text-zinc-500">Carregando...</p>;
  }

  if (isError || !aluno) {
    return (
      <div>
        <Link
          to="/alunos"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Voltar para alunos
        </Link>
        <p className="mt-4 rounded-xl bg-white px-5 py-4 text-sm text-red-600 shadow-sm">
          Erro ao carregar aluno.
        </p>
      </div>
    );
  }

  const planosAtivos = (planos ?? []).filter((p) => p.ativo);

  return (
    <div className="max-w-3xl">
      <Link to="/alunos" className="text-sm text-zinc-500 hover:underline">
        ← Voltar para alunos
      </Link>
      <div className="mb-4 mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{aluno.nome}</h2>
          <StatusAlunoBadge status={aluno.status} />
        </div>
        <button
          onClick={() => setEditando(true)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Editar
        </button>
      </div>

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">CPF</dt>
            <dd className="mt-0.5 text-sm">{formatarCpf(aluno.cpf)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">E-mail</dt>
            <dd className="mt-0.5 text-sm">{aluno.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Telefone</dt>
            <dd className="mt-0.5 text-sm">{aluno.telefone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Data de nascimento</dt>
            <dd className="mt-0.5 text-sm">
              {formatarData(aluno.dataNascimento)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Unidade</dt>
            <dd className="mt-0.5 text-sm">{aluno.unidade.nome}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Matrículas</h3>
          {!novaMatriculaAberta && (
            <button
              onClick={() => setNovaMatriculaAberta(true)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white"
            >
              Nova matrícula
            </button>
          )}
        </div>
        {novaMatriculaAberta && (
          <form
            onSubmit={submitMatricula}
            className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <label className="block text-sm">
              Plano
              <select
                required
                value={planoId}
                onChange={(e) => setPlanoId(e.target.value)}
                className="mt-1 block w-64 rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="">Selecione</option>
                {planosAtivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {formatarMoeda(p.valor)} ·{' '}
                    {PERIODO_LABEL[p.periodo]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Início
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="mt-1 block rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={criarMatricula.isPending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {criarMatricula.isPending ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNovaMatriculaAberta(false);
                setErroMatricula(null);
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-white"
            >
              Cancelar
            </button>
          </form>
        )}
        {erroMatricula && (
          <p className="mb-3 text-sm text-red-600">{erroMatricula}</p>
        )}
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="py-2 pr-4 font-medium">Plano</th>
              <th className="py-2 pr-4 font-medium">Período</th>
              <th className="py-2 pr-4 font-medium">Valor</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {aluno.matriculas.map((m) => (
              <tr key={m.id}>
                <td className="py-2.5 pr-4">
                  {m.plano.nome}
                  <span className="ml-1 text-xs text-zinc-500">
                    ({PERIODO_LABEL[m.plano.periodo]}
                    {m.plano.multiUnidade ? ', multi-unidade' : ''})
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-zinc-600">
                  {formatarData(m.dataInicio)} – {formatarData(m.dataFim)}
                </td>
                <td className="py-2.5 pr-4">{formatarMoeda(m.valor)}</td>
                <td className="py-2.5 pr-4">
                  <StatusMatriculaBadge status={m.status} />
                </td>
                <td className="py-2.5 text-right">
                  {m.status === 'ATIVA' && (
                    <button
                      onClick={() => confirmarCancelamento(m.id)}
                      disabled={cancelarMatricula.isPending}
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
        {aluno.matriculas.length === 0 && (
          <p className="py-3 text-sm text-zinc-500">
            Nenhuma matrícula registrada.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Últimos check-ins</h3>
        <ul className="divide-y divide-zinc-100">
          {(checkins ?? []).slice(0, 10).map((c) => (
            <li key={c.id} className="flex justify-between py-2 text-sm">
              <span className="text-zinc-700">{c.unidade.nome}</span>
              <span className="text-zinc-500">
                {formatarDataHora(c.criadoEm)} ·{' '}
                {c.metodo === 'MANUAL' ? 'Manual' : 'QR Code'}
              </span>
            </li>
          ))}
          {checkins?.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">
              Nenhum check-in registrado.
            </li>
          )}
        </ul>
      </div>

      {editando && (
        <AlunoForm aluno={aluno} onClose={() => setEditando(false)} />
      )}
    </div>
  );
}
