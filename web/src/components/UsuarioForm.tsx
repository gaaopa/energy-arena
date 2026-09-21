import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import type { Role } from '../lib/auth';
import type { Unidade } from './UnidadeForm';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  unidadeId?: string | null;
  criadoEm: string;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'RECEPCAO', label: 'Recepção' },
  { value: 'INSTRUTOR', label: 'Instrutor' },
  { value: 'ALUNO', label: 'Aluno' },
];

interface UsuarioFormProps {
  /** Usuário em edição; `null` para criar um novo. */
  usuario: Usuario | null;
  onClose: () => void;
}

function extrairMensagemErro(erro: unknown, fallback: string): string {
  const axiosErr = erro as AxiosError<{ message?: string | string[] }>;
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

export function UsuarioForm({ usuario, onClose }: UsuarioFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<Role>(usuario?.role ?? 'RECEPCAO');
  const [unidadeId, setUnidadeId] = useState(usuario?.unidadeId ?? '');
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const { data: unidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (usuario) {
        // PATCH não aceita e-mail; senha só vai se preenchida;
        // unidadeId: null desvincula a unidade.
        await api.patch(`/usuarios/${usuario.id}`, {
          nome: nome.trim(),
          role,
          unidadeId: unidadeId || null,
          ativo,
          ...(senha ? { senha } : {}),
        });
      } else {
        await api.post('/usuarios', {
          nome: nome.trim(),
          email: email.trim(),
          senha,
          role,
          unidadeId: unidadeId || null,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (err) =>
      setErro(extrairMensagemErro(err, 'Erro ao salvar usuário.')),
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
          {usuario ? 'Editar usuário' : 'Novo usuário'}
        </h3>
        <label className="mb-4 block text-sm">
          Nome
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        {usuario ? (
          <div className="mb-4 text-sm">
            <span className="text-zinc-500">E-mail (não editável)</span>
            <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500">
              {usuario.email}
            </p>
          </div>
        ) : (
          <label className="mb-4 block text-sm">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        )}
        <label className="mb-4 block text-sm">
          Senha
          <input
            type="password"
            required={!usuario}
            minLength={8}
            maxLength={72}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={
              usuario ? 'Deixe em branco para manter' : 'Mínimo de 8 caracteres'
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          Perfil
          <select
            required
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-4 block text-sm">
          Unidade
          <select
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Sem unidade</option>
            {(unidades ?? [])
              .filter((u) => u.ativo || u.id === unidadeId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                  {u.ativo ? '' : ' (inativa)'}
                </option>
              ))}
          </select>
        </label>
        {usuario && (
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4"
            />
            Usuário ativo
          </label>
        )}
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
