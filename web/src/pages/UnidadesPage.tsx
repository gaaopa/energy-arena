import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { UnidadeForm, type Unidade } from '../components/UnidadeForm';

function extrairMensagemErro(erro: unknown, fallback: string): string {
  const axiosErr = erro as AxiosError<{ message?: string | string[] }>;
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

export function UnidadesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Unidade | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { data: unidades, isPending, isError } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const toggleAtivo = useMutation({
    mutationFn: async (unidade: Unidade) =>
      api.patch(`/unidades/${unidade.id}`, { ativo: !unidade.ativo }),
    onSuccess: () => {
      setErroAcao(null);
      void queryClient.invalidateQueries({ queryKey: ['unidades'] });
    },
    onError: (err) =>
      setErroAcao(extrairMensagemErro(err, 'Erro ao atualizar unidade.')),
  });

  function abrirCriacao() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(unidade: Unidade) {
    setEditando(unidade);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditando(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Unidades</h2>
        {isAdmin && (
          <button
            onClick={abrirCriacao}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            Nova unidade
          </button>
        )}
      </div>
      {erroAcao && <p className="mb-2 text-sm text-red-600">{erroAcao}</p>}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Endereço</th>
              <th className="px-5 py-3 font-medium">Telefone</th>
              <th className="px-5 py-3 font-medium">Status</th>
              {isAdmin && <th className="px-5 py-3 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(unidades ?? []).map((unidade) => (
              <tr key={unidade.id}>
                <td className="px-5 py-3">{unidade.nome}</td>
                <td className="px-5 py-3">{unidade.endereco ?? '—'}</td>
                <td className="px-5 py-3">{unidade.telefone ?? '—'}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      unidade.ativo
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {unidade.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => abrirEdicao(unidade)}
                        className="text-xs font-medium text-zinc-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleAtivo.mutate(unidade)}
                        disabled={toggleAtivo.isPending}
                        className={`text-xs font-medium hover:underline disabled:opacity-50 ${
                          unidade.ativo ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {unidade.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && (
          <p className="px-5 py-4 text-sm text-zinc-500">Carregando...</p>
        )}
        {isError && (
          <p className="px-5 py-4 text-sm text-red-600">
            Erro ao carregar unidades.
          </p>
        )}
        {!isPending && !isError && unidades?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhuma unidade cadastrada.
          </p>
        )}
      </div>
      {formAberto && (
        <UnidadeForm unidade={editando} onClose={fecharForm} />
      )}
    </div>
  );
}
