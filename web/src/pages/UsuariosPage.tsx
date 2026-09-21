import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Role } from '../lib/auth';
import { UsuarioForm, type Usuario } from '../components/UsuarioForm';
import type { Unidade } from '../components/UnidadeForm';

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  RECEPCAO: 'Recepção',
  INSTRUTOR: 'Instrutor',
  ALUNO: 'Aluno',
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-zinc-900 text-white',
  RECEPCAO: 'bg-sky-100 text-sky-800',
  INSTRUTOR: 'bg-violet-100 text-violet-800',
  ALUNO: 'bg-zinc-100 text-zinc-600',
};

export function UsuariosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  // /usuarios é ADMIN-only: a query fica desabilitada para outros perfis.
  const { data: usuarios, isPending, isError, error } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get<Usuario[]>('/usuarios')).data,
    enabled: isAdmin,
  });

  // Join client-side para exibir o nome da unidade de cada usuário.
  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
    enabled: isAdmin,
  });

  const unidadePorId = new Map(
    (unidades ?? []).map((u) => [u.id, u.nome] as const),
  );

  function abrirCriacao() {
    setEditando(null);
    setFormAberto(true);
  }

  function abrirEdicao(usuario: Usuario) {
    setEditando(usuario);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditando(null);
  }

  if (!isAdmin) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Usuários</h2>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-500">
            Acesso restrito: apenas administradores podem gerenciar usuários.
          </p>
        </div>
      </div>
    );
  }

  const erroForbidden = isAxiosError(error) && error.response?.status === 403;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Usuários</h2>
        <button
          onClick={abrirCriacao}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Novo usuário
        </button>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">E-mail</th>
              <th className="px-5 py-3 font-medium">Perfil</th>
              <th className="px-5 py-3 font-medium">Unidade</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(usuarios ?? []).map((usuario) => (
              <tr key={usuario.id}>
                <td className="px-5 py-3">{usuario.nome}</td>
                <td className="px-5 py-3">{usuario.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[usuario.role]}`}
                  >
                    {ROLE_LABEL[usuario.role]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {usuario.unidadeId
                    ? (unidadePorId.get(usuario.unidadeId) ?? '—')
                    : '—'}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      usuario.ativo
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => abrirEdicao(usuario)}
                    className="text-xs font-medium text-zinc-600 hover:underline"
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
            {erroForbidden
              ? 'Acesso restrito: apenas administradores podem gerenciar usuários.'
              : 'Erro ao carregar usuários.'}
          </p>
        )}
        {!isPending && !isError && usuarios?.length === 0 && (
          <p className="px-5 py-4 text-sm text-zinc-500">
            Nenhum usuário cadastrado.
          </p>
        )}
      </div>
      {formAberto && (
        <UsuarioForm usuario={editando} onClose={fecharForm} />
      )}
    </div>
  );
}
