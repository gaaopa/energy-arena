import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { StatusAluno } from './AlunoStatusBadge';

interface Unidade {
  id: string;
  nome: string;
  ativo: boolean;
}

// Campos mínimos que o formulário precisa para editar um aluno.
// Tanto o item da lista (GET /alunos) quanto o detalhe (GET /alunos/:id)
// satisfazem esta interface.
export interface AlunoParaForm {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  status: StatusAluno;
  unidadeId: string;
}

interface AlunoFormProps {
  aluno?: AlunoParaForm | null;
  onClose: () => void;
}

// Máscara progressiva xxx.xxx.xxx-xx enquanto o usuário digita
function mascaraCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function extrairMensagemErro(err: unknown, fallback: string): string {
  const msg = (err as AxiosError<{ message?: string | string[] }>).response
    ?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

const inputClasses =
  'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm';

export function AlunoForm({ aluno, onClose }: AlunoFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const editando = !!aluno;

  const [nome, setNome] = useState(aluno?.nome ?? '');
  const [cpf, setCpf] = useState(aluno?.cpf ? mascaraCpf(aluno.cpf) : '');
  const [email, setEmail] = useState(aluno?.email ?? '');
  const [telefone, setTelefone] = useState(aluno?.telefone ?? '');
  const [dataNascimento, setDataNascimento] = useState(
    aluno?.dataNascimento?.slice(0, 10) ?? '',
  );
  const [unidadeId, setUnidadeId] = useState(
    aluno?.unidadeId ?? user?.unidadeId ?? '',
  );
  const [status, setStatus] = useState<StatusAluno>(aluno?.status ?? 'ATIVO');
  const [erro, setErro] = useState<string | null>(null);

  const { data: unidades, isError: erroUnidades } = useQuery({
    queryKey: ['unidades'],
    queryFn: async () => (await api.get<Unidade[]>('/unidades')).data,
  });

  // Esconde unidades inativas, mas mantém a unidade atual do aluno visível
  const unidadesVisiveis = (unidades ?? []).filter(
    (u) => u.ativo || u.id === unidadeId,
  );

  const salvar = useMutation({
    mutationFn: async () => {
      const base = {
        nome: nome.trim(),
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        dataNascimento: dataNascimento || undefined,
        unidadeId,
      };
      if (aluno) {
        return api.patch(`/alunos/${aluno.id}`, { ...base, status });
      }
      return api.post('/alunos', { ...base, cpf: cpf.replace(/\D/g, '') });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alunos'] });
      onClose();
    },
    onError: (err) =>
      setErro(extrairMensagemErro(err, 'Erro ao salvar aluno.')),
  });

  function validar(): string | null {
    if (!nome.trim()) return 'Informe o nome do aluno.';
    if (!editando && cpf.replace(/\D/g, '').length !== 11) {
      return 'CPF deve conter 11 dígitos numéricos.';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'E-mail inválido.';
    }
    if (!unidadeId) return 'Selecione a unidade.';
    return null;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (salvar.isPending) return;
    const erroValidacao = validar();
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }
    setErro(null);
    salvar.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold">
          {editando ? 'Editar aluno' : 'Novo aluno'}
        </h3>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              Nome *
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClasses}
              />
            </label>
            {!editando && (
              <label className="block text-sm">
                CPF *
                <input
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                  className={inputClasses}
                />
              </label>
            )}
            <label className="block text-sm">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />
            </label>
            <label className="block text-sm">
              Telefone
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className={inputClasses}
              />
            </label>
            <label className="block text-sm">
              Data de nascimento
              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={inputClasses}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              Unidade *
              <select
                required
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
                className={inputClasses}
              >
                <option value="">Selecione</option>
                {unidadesVisiveis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
            {editando && (
              <label className="block text-sm sm:col-span-2">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusAluno)}
                  className={inputClasses}
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="SUSPENSO">Suspenso</option>
                </select>
              </label>
            )}
          </div>
          {erroUnidades && (
            <p className="mt-4 text-sm text-red-600">
              Erro ao carregar unidades.
            </p>
          )}
          {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
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
    </div>
  );
}
