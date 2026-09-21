import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PERIODO_LABEL, type Periodo } from './PlanoForm';

interface Aluno {
  id: string;
  nome: string;
  cpf: string;
  status: string;
  unidade: { id: string; nome: string };
}

interface PlanoResumo {
  id: string;
  nome: string;
  valor: number | string;
  periodo: Periodo;
  ativo: boolean;
}

interface Unidade {
  id: string;
  nome: string;
  ativo: boolean;
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function hojeISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function MatriculaForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [debounced, setDebounced] = useState('');
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [planoId, setPlanoId] = useState('');
  const [unidadeId, setUnidadeId] = useState(user?.unidadeId ?? '');
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: alunos, isFetching: buscandoAlunos } = useQuery({
    queryKey: ['alunos', 'busca', debounced],
    queryFn: async () =>
      (await api.get<Aluno[]>('/alunos', { params: { busca: debounced } }))
        .data,
    enabled: debounced.length > 0 && !aluno,
  });

  const { data: planos } = useQuery({
    queryKey: ['planos'],
    queryFn: async () => (await api.get<PlanoResumo[]>('/planos')).data,
  });

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const planoSel = (planos ?? []).find((p) => p.id === planoId);
  const unidadeFixaNome = user?.unidadeId
    ? (unidades ?? []).find((u) => u.id === user.unidadeId)?.nome
    : undefined;

  const criar = useMutation({
    mutationFn: async () =>
      api.post('/matriculas', {
        alunoId: aluno?.id,
        planoId,
        unidadeId,
        dataInicio,
        valor: valor.trim() ? Number(valor) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matriculas'] });
      onClose();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const msg = axiosErr.response?.data?.message;
      setErro(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Erro ao criar matrícula.'),
      );
    },
  });

  function selecionarAluno(a: Aluno) {
    setAluno(a);
    setBusca('');
    setDebounced('');
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (criar.isPending) return;
    setErro(null);
    criar.mutate();
  }

  const podeSalvar =
    aluno !== null && planoId !== '' && unidadeId !== '' && dataInicio !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
      >
        <h3 className="mb-4 text-lg font-semibold">Nova matrícula</h3>
        <div className="mb-4">
          <span className="text-sm">Aluno</span>
          {aluno ? (
            <div className="mt-1 flex items-center justify-between rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <span>
                {aluno.nome}{' '}
                <span className="text-zinc-500">· {aluno.cpf}</span>
              </span>
              <button
                type="button"
                onClick={() => setAluno(null)}
                className="text-xs text-red-600 hover:underline"
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF ou e-mail"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              {debounced !== '' && (
                <ul className="mt-1 max-h-44 overflow-auto rounded-md border border-zinc-200">
                  {buscandoAlunos && (
                    <li className="px-3 py-2 text-sm text-zinc-500">
                      Buscando...
                    </li>
                  )}
                  {(alunos ?? []).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => selecionarAluno(a)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      >
                        {a.nome}{' '}
                        <span className="text-zinc-500">
                          · {a.cpf} · {a.unidade.nome}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!buscandoAlunos && alunos?.length === 0 && (
                    <li className="px-3 py-2 text-sm text-zinc-500">
                      Nenhum aluno encontrado.
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Plano
            <select
              required
              value={planoId}
              onChange={(e) => setPlanoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="">Selecione</option>
              {(planos ?? [])
                .filter((p) => p.ativo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({PERIODO_LABEL[p.periodo]})
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            Data de início
            <input
              required
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="text-sm">
            Unidade
            {user?.unidadeId ? (
              <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-700">
                {unidadeFixaNome ?? 'Sua unidade'}
              </p>
            ) : (
              <select
                required
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="">Selecione</option>
                {(unidades ?? [])
                  .filter((u) => u.ativo)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <label className="block text-sm">
            Valor <span className="text-zinc-400">(opcional)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={
                planoSel
                  ? `Padrão: ${brl.format(Number(planoSel.valor))}`
                  : 'Valor do plano'
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!podeSalvar || criar.isPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {criar.isPending ? 'Salvando...' : 'Criar matrícula'}
          </button>
        </div>
      </form>
    </div>
  );
}
