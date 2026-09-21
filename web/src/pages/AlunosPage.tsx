import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AlunoForm, type AlunoParaForm } from '../components/AlunoForm';
import {
  StatusAlunoBadge,
  type StatusAluno,
} from '../components/AlunoStatusBadge';

interface Aluno {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  status: StatusAluno;
  unidadeId: string;
  unidade: { id: string; nome: string };
}

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function AlunosPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<AlunoParaForm | null>(null);

  // Debounce ~300ms para não disparar uma requisição a cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca.trim()), 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const { data: alunos, isPending, isError } = useQuery({
    queryKey: ['alunos', 'lista', buscaDebounced, statusFiltro],
    queryFn: async () => {
      const res = await api.get<Aluno[]>('/alunos', {
        params: {
          ...(buscaDebounced ? { busca: buscaDebounced } : {}),
          ...(statusFiltro ? { status: statusFiltro } : {}),
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  function abrirCadastro() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(aluno: Aluno) {
    setEditando(aluno);
    setFormAberto(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Alunos</h2>
        <button
          onClick={abrirCadastro}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Novo aluno
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Buscar por nome, CPF ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-72 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
          <option value="SUSPENSO">Suspenso</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">CPF</th>
              <th className="px-5 py-3 font-medium">Unidade</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(alunos ?? []).map((aluno) => (
              <tr key={aluno.id} className="hover:bg-zinc-50">
                <td className="px-5 py-3">
                  <Link
                    to={`/alunos/${aluno.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {aluno.nome}
                  </Link>
                </td>
                <td className="px-5 py-3 text-zinc-600">
                  {formatarCpf(aluno.cpf)}
                </td>
                <td className="px-5 py-3 text-zinc-600">
                  {aluno.unidade.nome}
                </td>
                <td className="px-5 py-3">
                  <StatusAlunoBadge status={aluno.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => abrirEdicao(aluno)}
                    className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline"
                  >
                    Editar
                  </button>
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
            Erro ao carregar alunos.
          </p>
        )}
        {!isPending && !isError && alunos?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhum aluno encontrado.
          </p>
        )}
      </div>
      {formAberto && (
        <AlunoForm aluno={editando} onClose={() => setFormAberto(false)} />
      )}
    </div>
  );
}
