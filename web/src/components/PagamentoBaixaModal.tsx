import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '../lib/api';

export type MetodoPagamento =
  | 'PIX'
  | 'BOLETO'
  | 'CARTAO_CREDITO'
  | 'CARTAO_DEBITO'
  | 'DINHEIRO';

export const METODO_LABELS: Record<MetodoPagamento, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  DINHEIRO: 'Dinheiro',
};

interface PagamentoBaixaModalProps {
  pagamentoId: string;
  alunoNome: string;
  valorFormatado: string;
  onClose: () => void;
}

export function PagamentoBaixaModal({
  pagamentoId,
  alunoNome,
  valorFormatado,
  onClose,
}: PagamentoBaixaModalProps) {
  const queryClient = useQueryClient();
  const [metodo, setMetodo] = useState<MetodoPagamento | ''>('');
  const [referencia, setReferencia] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const baixar = useMutation({
    mutationFn: async (metodoEscolhido: MetodoPagamento) =>
      api.patch(`/pagamentos/${pagamentoId}/pagar`, {
        metodo: metodoEscolhido,
        ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pagamentos'] });
      onClose();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const msg = axiosErr.response?.data?.message;
      setErro(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Erro ao baixar pagamento.'),
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!metodo || baixar.isPending) return;
    setErro(null);
    baixar.mutate(metodo);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
      >
        <h3 className="mb-1 text-lg font-semibold">Baixar pagamento</h3>
        <p className="mb-4 text-sm text-zinc-500">
          {alunoNome} · {valorFormatado}
        </p>
        <label className="mb-4 block text-sm">
          Método de pagamento
          <select
            required
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoPagamento)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="">Selecione</option>
            {(Object.keys(METODO_LABELS) as MetodoPagamento[]).map((m) => (
              <option key={m} value={m}>
                {METODO_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-4 block text-sm">
          Referência <span className="text-zinc-400">(opcional)</span>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ex.: ID da transação, nº do boleto"
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
            disabled={!metodo || baixar.isPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {baixar.isPending ? 'Baixando...' : 'Confirmar baixa'}
          </button>
        </div>
      </form>
    </div>
  );
}
