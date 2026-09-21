import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';

export interface Unidade {
  id: string;
  nome: string;
  endereco?: string | null;
  telefone?: string | null;
  ativo: boolean;
  criadoEm: string;
}

interface UnidadeFormProps {
  /** Unidade em edição; `null` para criar uma nova. */
  unidade: Unidade | null;
  onClose: () => void;
}

function extrairMensagemErro(erro: unknown, fallback: string): string {
  const axiosErr = erro as AxiosError<{ message?: string | string[] }>;
  const msg = axiosErr.response?.data?.message;
  return Array.isArray(msg) ? msg.join(', ') : (msg ?? fallback);
}

export function UnidadeForm({ unidade, onClose }: UnidadeFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(unidade?.nome ?? '');
  const [endereco, setEndereco] = useState(unidade?.endereco ?? '');
  const [telefone, setTelefone] = useState(unidade?.telefone ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: async () => {
      // Campos vazios viram null: a API trata null como "limpar campo"
      // (@IsOptional ignora null; Prisma grava null na coluna).
      const payload = {
        nome: nome.trim(),
        endereco: endereco.trim() || null,
        telefone: telefone.trim() || null,
      };
      if (unidade) {
        await api.patch(`/unidades/${unidade.id}`, payload);
      } else {
        await api.post('/unidades', payload);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['unidades'] });
      onClose();
    },
    onError: (err) =>
      setErro(extrairMensagemErro(err, 'Erro ao salvar unidade.')),
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
          {unidade ? 'Editar unidade' : 'Nova unidade'}
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
        <label className="mb-4 block text-sm">
          Endereço
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Opcional"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          Telefone
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Opcional"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
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
