import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';

export type Periodo = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';

export interface Plano {
  id: string;
  nome: string;
  descricao?: string | null;
  valor: number | string;
  periodo: Periodo;
  recorrente: boolean;
  multiUnidade: boolean;
  ativo: boolean;
}

export const PERIODO_LABEL: Record<Periodo, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

interface PlanoFormProps {
  plano: Plano | null;
  onClose: () => void;
}

export function PlanoForm({ plano, onClose }: PlanoFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [descricao, setDescricao] = useState(plano?.descricao ?? '');
  const [valor, setValor] = useState(plano ? String(plano.valor) : '');
  const [periodo, setPeriodo] = useState<Periodo>(plano?.periodo ?? 'MENSAL');
  const [recorrente, setRecorrente] = useState(plano?.recorrente ?? false);
  const [multiUnidade, setMultiUnidade] = useState(
    plano?.multiUnidade ?? false,
  );
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        valor: Number(valor),
        periodo,
        recorrente,
        multiUnidade,
      };
      if (plano) {
        return api.patch(`/planos/${plano.id}`, { ...payload, ativo });
      }
      return api.post('/planos', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planos'] });
      onClose();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const msg = axiosErr.response?.data?.message;
      setErro(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Erro ao salvar plano.'),
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (salvar.isPending) return;
    setErro(null);
    salvar.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
      >
        <h3 className="mb-4 text-lg font-semibold">
          {plano ? 'Editar plano' : 'Novo plano'}
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
          Descrição <span className="text-zinc-400">(opcional)</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Valor (R$)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Período
            <select
              required
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
                <option key={p} value={p}>
                  {PERIODO_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recorrente}
            onChange={(e) => setRecorrente(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          Recorrente (sem fim — cobra a cada período até cancelar)
        </label>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={multiUnidade}
            onChange={(e) => setMultiUnidade(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          Multi-unidade (vale em todas as unidades)
        </label>
        {plano && (
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 accent-zinc-900"
            />
            Plano ativo
          </label>
        )}
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
