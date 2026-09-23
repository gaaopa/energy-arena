import { useEffect, useState, type FormEvent } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Unidade {
  id: string;
  nome: string;
}

interface AlunoBusca {
  id: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
  unidade: { id: string; nome: string };
}

interface CheckInCriado {
  id: string;
  criadoEm: string;
  saiuEm: string | null;
  aluno: { id: string; nome: string };
  unidade: { id: string; nome: string };
}

interface Mensagem {
  texto: string;
  tipo: 'ok' | 'erro';
}

const STATUS_LABEL: Record<AlunoBusca['status'], string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  SUSPENSO: 'Suspenso',
};

function extrairMensagemErro(err: unknown, fallback: string): string {
  const msg = (err as AxiosError<{ message?: string | string[] }>).response
    ?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

export function CheckInPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buscaAluno, setBuscaAluno] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [alunoSel, setAlunoSel] = useState<AlunoBusca | null>(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [unidadeId, setUnidadeId] = useState(user?.unidadeId ?? '');
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  // Debounce ~300ms para a busca de alunos
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(buscaAluno.trim()), 300);
    return () => clearTimeout(timer);
  }, [buscaAluno]);

  const { data: unidades, isError: erroUnidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const { data: sugestoes, isFetching: buscando } = useQuery({
    queryKey: ['alunos', 'busca-checkin', buscaDebounced],
    queryFn: async () =>
      (
        await api.get<AlunoBusca[]>('/alunos', {
          params: { busca: buscaDebounced },
        })
      ).data,
    enabled: buscaDebounced.length >= 2 && !alunoSel,
    placeholderData: keepPreviousData,
  });

  const checkin = useMutation({
    mutationFn: async (alunoId: string) =>
      (
        await api.post<CheckInCriado>('/checkins', {
          alunoId,
          unidadeId,
          metodo: 'MANUAL',
        })
      ).data,
    onSuccess: (data) => {
      setMensagem({
        tipo: 'ok',
        texto: `Check-in registrado: ${data.aluno.nome} — ${data.unidade.nome}`,
      });
      setAlunoSel(null);
      setBuscaAluno('');
      void queryClient.invalidateQueries({ queryKey: ['checkins'] });
    },
    onError: (err) => {
      setMensagem({
        tipo: 'erro',
        texto: extrairMensagemErro(err, 'Erro ao registrar check-in.'),
      });
    },
  });

  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const { data: hoje } = useQuery({
    queryKey: ['checkins', 'hoje', unidadeId],
    queryFn: async () =>
      (
        await api.get<CheckInCriado[]>('/checkins', {
          params: {
            de: inicioDia.toISOString(),
            ...(unidadeId ? { unidadeId } : {}),
          },
        })
      ).data,
  });

  const saida = useMutation({
    mutationFn: async (id: string) =>
      (await api.patch<CheckInCriado>(`/checkins/${id}/saida`)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkins'] });
    },
    onError: (err) => {
      setMensagem({
        tipo: 'erro',
        texto: extrairMensagemErro(err, 'Erro ao registrar saída.'),
      });
    },
  });

  function fmtHora(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  function fmtDuracao(entrada: string, saidaIso: string) {
    const min = Math.round(
      (new Date(saidaIso).getTime() - new Date(entrada).getTime()) / 60_000,
    );
    const h = Math.floor(min / 60);
    return h > 0
      ? `${h}h${String(min % 60).padStart(2, '0')}`
      : `${min}min`;
  }

  function selecionar(aluno: AlunoBusca) {
    setAlunoSel(aluno);
    setBuscaAluno(aluno.nome);
    setListaAberta(false);
    setMensagem(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Guard contra double-submit / duplo clique
    if (checkin.isPending) return;
    if (!alunoSel) {
      setMensagem({
        tipo: 'erro',
        texto: 'Busque e selecione um aluno na lista.',
      });
      return;
    }
    if (!unidadeId) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a unidade.' });
      return;
    }
    setMensagem(null);
    checkin.mutate(alunoSel.id);
  }

  const mostrarLista =
    listaAberta && !alunoSel && buscaDebounced.length >= 2;
  const listaVazia = !buscando && (sugestoes ?? []).length === 0;

  return (
    <div className="max-w-md">
      <h2 className="mb-4 text-2xl font-bold">Check-in manual</h2>
      <form
        onSubmit={onSubmit}
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="relative mb-4">
          <label className="block text-sm">
            Aluno
            <input
              value={buscaAluno}
              onChange={(e) => {
                setBuscaAluno(e.target.value);
                setAlunoSel(null);
                setListaAberta(true);
              }}
              onFocus={() => setListaAberta(true)}
              onBlur={() => {
                // Pequeno atraso para o clique na lista registrar a seleção
                setTimeout(() => setListaAberta(false), 150);
              }}
              placeholder="Digite nome, CPF ou e-mail"
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          {alunoSel ? (
            <p className="mt-1 text-xs text-emerald-700">
              Selecionado: {alunoSel.nome} — {alunoSel.unidade.nome}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Digite ao menos 2 caracteres para buscar.
            </p>
          )}
          {mostrarLista && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg">
              {(sugestoes ?? []).slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    // onMouseDown dispara antes do onBlur do input
                    onMouseDown={() => selecionar(a)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100"
                  >
                    <span className="truncate">{a.nome}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {a.unidade.nome} · {STATUS_LABEL[a.status]}
                    </span>
                  </button>
                </li>
              ))}
              {buscando && (sugestoes ?? []).length === 0 && (
                <li className="px-3 py-2 text-sm text-zinc-500">
                  Buscando...
                </li>
              )}
              {listaVazia && (
                <li className="px-3 py-2 text-sm text-zinc-500">
                  Nenhum aluno encontrado.
                </li>
              )}
            </ul>
          )}
        </div>
        <label className="mb-4 block text-sm">
          Unidade
          <select
            required
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Selecione</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        {erroUnidades && (
          <p className="mb-4 text-sm text-red-600">
            Erro ao carregar unidades.
          </p>
        )}
        {mensagem && (
          <p
            className={`mb-4 text-sm ${
              mensagem.tipo === 'erro' ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {mensagem.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={checkin.isPending}
          className="w-full rounded-md bg-zinc-900 py-2 text-white disabled:opacity-50"
        >
          {checkin.isPending ? 'Registrando...' : 'Registrar check-in'}
        </button>
      </form>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Check-ins de hoje</h3>
        <ul className="divide-y divide-zinc-100">
          {(hoje ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{c.aluno.nome}</p>
                <p className="text-xs text-zinc-500">
                  {c.unidade.nome} · entrada {fmtHora(c.criadoEm)}
                  {c.saiuEm
                    ? ` · saída ${fmtHora(c.saiuEm)} · ${fmtDuracao(c.criadoEm, c.saiuEm)}`
                    : ''}
                </p>
              </div>
              {c.saiuEm ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  Concluído
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => saida.mutate(c.id)}
                  disabled={saida.isPending}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
                >
                  Registrar saída
                </button>
              )}
            </li>
          ))}
          {(hoje ?? []).length === 0 && (
            <li className="py-3 text-sm text-zinc-500">
              Nenhum check-in hoje{unidadeId ? ' nesta unidade' : ''}.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
