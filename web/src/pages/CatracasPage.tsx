import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Navigate } from 'react-router-dom';

interface Catraca {
  id: string;
  nome: string;
  unidadeId: string;
  unidade: { id: string; nome: string };
  url: string;
  login: string;
  token: string;
  ativo: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

function extrairMensagemErro(erro: unknown, fallback: string): string {
  const msg = (erro as AxiosError<{ message?: string | string[] }>).response
    ?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

const inputClasses =
  'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm';

function CatracaForm({
  catraca,
  onClose,
}: {
  catraca: Catraca | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(catraca?.nome ?? '');
  const [unidadeId, setUnidadeId] = useState(catraca?.unidadeId ?? '');
  const [url, setUrl] = useState(catraca?.url ?? '');
  const [login, setLogin] = useState(catraca?.login ?? 'admin');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        unidadeId,
        url: url.trim(),
        login: login.trim(),
        ...(senha ? { senha } : {}),
      };
      if (catraca) {
        // Sem senha nova → mantém a atual (o backend omite senha nos GETs)
        await api.patch(`/catracas/${catraca.id}`, payload);
      } else {
        if (!senha) throw new Error('Informe a senha do terminal.');
        await api.post('/catracas', { ...payload, senha });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catracas'] });
      onClose();
    },
    onError: (err) =>
      setErro(extrairMensagemErro(err, 'Erro ao salvar catraca.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (salvar.isPending) return;
    setErro(null);
    salvar.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
      >
        <h3 className="mb-4 text-lg font-semibold">
          {catraca ? 'Editar catraca' : 'Nova catraca'}
        </h3>
        <label className="mb-3 block text-sm">
          Nome
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Entrada principal"
            className={inputClasses}
          />
        </label>
        <label className="mb-3 block text-sm">
          Unidade
          <select
            required
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className={inputClasses}
          >
            <option value="">Selecione</option>
            {(unidades ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block text-sm">
          URL do terminal
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.0.50"
            className={inputClasses}
          />
        </label>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Login
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={inputClasses}
            />
          </label>
          <label className="block text-sm">
            Senha {catraca && <span className="text-zinc-400">(manter)</span>}
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={catraca ? 'Deixe vazio p/ manter' : 'admin'}
              className={inputClasses}
            />
          </label>
        </div>
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvar.isPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CatracasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Catraca | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const { data: catracas, isPending, isError } = useQuery({
    queryKey: ['catracas'],
    queryFn: async () => (await api.get<Catraca[]>('/catracas')).data,
    enabled: user?.role === 'ADMIN',
  });

  const acao = useMutation({
    mutationFn: async (params: {
      catraca: Catraca;
      tipo: 'testar' | 'sincronizar' | 'toggle';
    }) => {
      const { catraca, tipo } = params;
      if (tipo === 'toggle') {
        await api.patch(`/catracas/${catraca.id}`, { ativo: !catraca.ativo });
        return { tipo, texto: catraca.ativo ? 'Desativada' : 'Ativada' };
      }
      const res = await api.post(`/catracas/${catraca.id}/${tipo}`);
      return {
        tipo,
        texto:
          tipo === 'testar'
            ? res.data.ok
              ? 'Online ✓'
              : `Offline: ${res.data.erro}`
            : `Sincronizados ${res.data.total} alunos (${res.data.falhas?.length ?? 0} falhas)`,
      };
    },
    onSuccess: (r, vars) => {
      setFeedback((f) => ({ ...f, [vars.catraca.id]: r.texto }));
      void queryClient.invalidateQueries({ queryKey: ['catracas'] });
    },
    onError: (err, vars) =>
      setFeedback((f) => ({
        ...f,
        [vars.catraca.id]: extrairMensagemErro(err, 'Falha na operação'),
      })),
  });

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Catracas</h2>
        <button
          onClick={() => {
            setEditando(null);
            setFormAberto(true);
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Nova catraca
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Configure no iDFace a URL de notificação de acesso apontando para o
        endpoint de eventos de cada dispositivo.
      </p>
      <div className="space-y-3">
        {(catracas ?? []).map((c) => (
          <div key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {c.nome}
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.ativo
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {c.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {c.unidade.nome} · {c.url}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => acao.mutate({ catraca: c, tipo: 'testar' })}
                  disabled={acao.isPending}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Testar
                </button>
                <button
                  onClick={() =>
                    acao.mutate({ catraca: c, tipo: 'sincronizar' })
                  }
                  disabled={acao.isPending}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Sincronizar alunos
                </button>
                <button
                  onClick={() => {
                    setEditando(c);
                    setFormAberto(true);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => acao.mutate({ catraca: c, tipo: 'toggle' })}
                  disabled={acao.isPending}
                  className={`rounded-md border px-3 py-1.5 disabled:opacity-50 ${
                    c.ativo
                      ? 'border-red-300 text-red-600 hover:bg-red-50'
                      : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {c.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
            <p className="mt-2 select-all break-all rounded-md bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-600">
              POST /api/catracas/eventos/{c.token}
            </p>
            {feedback[c.id] && (
              <p className="mt-2 text-xs text-zinc-600">{feedback[c.id]}</p>
            )}
          </div>
        ))}
        {isPending && <p className="text-sm text-zinc-500">Carregando...</p>}
        {isError && (
          <p className="text-sm text-red-600">Erro ao carregar catracas.</p>
        )}
        {!isPending && !isError && catracas?.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
            Nenhuma catraca cadastrada.
          </p>
        )}
      </div>
      {formAberto && (
        <CatracaForm
          catraca={editando}
          onClose={() => {
            setFormAberto(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}
