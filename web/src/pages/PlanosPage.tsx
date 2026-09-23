import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  PlanoForm,
  PERIODO_LABEL,
  type Plano,
} from '../components/PlanoForm';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function PlanosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Plano | null>(null);

  const { data: planos, isPending, isError } = useQuery({
    queryKey: ['planos'],
    queryFn: async () => (await api.get<Plano[]>('/planos')).data,
  });

  function abrirNovo() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(plano: Plano) {
    setEditando(plano);
    setFormAberto(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Planos</h2>
        {isAdmin && (
          <button
            onClick={abrirNovo}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            Novo plano
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Abrangência</th>
              <th className="px-5 py-3 font-medium">Status</th>
              {isAdmin && <th className="px-5 py-3 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(planos ?? []).map((plano) => (
              <tr key={plano.id}>
                <td className="px-5 py-3">
                  <span className="font-medium">{plano.nome}</span>
                  {plano.descricao && (
                    <span className="block text-xs text-zinc-500">
                      {plano.descricao}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">{brl.format(Number(plano.valor))}</td>
                <td className="px-5 py-3">
                  {PERIODO_LABEL[plano.periodo]}
                  {plano.recorrente && (
                    <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      Recorrente
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {plano.multiUnidade ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Multi-unidade
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">Uma unidade</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      plano.ativo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-200 text-zinc-600'
                    }`}
                  >
                    {plano.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-5 py-3">
                    <button
                      onClick={() => abrirEdicao(plano)}
                      className="text-sm text-zinc-600 hover:underline"
                    >
                      Editar
                    </button>
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
            Erro ao carregar planos.
          </p>
        )}
        {!isPending && planos?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhum plano cadastrado.
          </p>
        )}
      </div>
      {formAberto && (
        <PlanoForm plano={editando} onClose={() => setFormAberto(false)} />
      )}
    </div>
  );
}
