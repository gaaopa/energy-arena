import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { PERIODO_LABEL, type Periodo } from './PlanoForm';

interface PlanoResumo {
  id: string;
  nome: string;
  valor: number | string;
  periodo: Periodo;
  recorrente: boolean;
  ativo: boolean;
}

export interface MatriculaParaTroca {
  id: string;
  plano: { id: string; nome: string };
  aluno?: { nome: string };
}

interface TrocarPlanoFormProps {
  matricula: MatriculaParaTroca;
  onClose: () => void;
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function hojeISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TrocarPlanoForm({ matricula, onClose }: TrocarPlanoFormProps) {
  const queryClient = useQueryClient();
  const [planoId, setPlanoId] = useState('');
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data: planos } = useQuery({
    queryKey: ['planos'],
    queryFn: async () => (await api.get<PlanoResumo[]>('/planos')).data,
  });

  const opcoes = (planos ?? []).filter(
    (p) => p.ativo && p.id !== matricula.plano.id,
  );
  const planoSel = opcoes.find((p) => p.id === planoId);

  const trocar = useMutation({
    mutationFn: async () =>
      api.patch(`/matriculas/${matricula.id}/trocar-plano`, {
        planoId,
        dataInicio,
        valor: valor.trim() ? Number(valor) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matriculas'] });
      void queryClient.invalidateQueries({ queryKey: ['alunos'] });
      void queryClient.invalidateQueries({ queryKey: ['pagamentos'] });
      onClose();
    },
    onError: (err) => {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const msg = axiosErr.response?.data?.message;
      setErro(
        Array.isArray(msg)
          ? msg.join(', ')
          : (msg ?? 'Erro ao trocar plano.'),
      );
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (trocar.isPending) return;
    setErro(null);
    trocar.mutate();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
      >
        <h3 className="mb-1 text-lg font-semibold">Trocar plano</h3>
        <p className="mb-4 text-sm text-zinc-500">
          {matricula.aluno?.nome ? `${matricula.aluno.nome} · ` : ''}
          Plano atual: <strong>{matricula.plano.nome}</strong>. A matrícula
          atual será encerrada e uma nova será criada — cobranças pendentes são
          canceladas e o histórico é preservado.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <label className="block text-sm">
            Novo plano
            <select
              required
              value={planoId}
              onChange={(e) => setPlanoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="">Selecione</option>
              {planos && opcoes.length === 0 && (
                <option value="" disabled>
                  Nenhum outro plano ativo disponível
                </option>
              )}
              {opcoes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({PERIODO_LABEL[p.periodo]}
                  {p.recorrente ? ', recorrente' : ''})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Início do novo plano
            <input
              required
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="mb-4 block text-sm">
          Valor <span className="text-zinc-400">(opcional)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={
              planoSel
                ? `Padrão: ${brl.format(Number(planoSel.valor))}`
                : 'Valor do plano'
            }
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
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
            disabled={!planoId || trocar.isPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {trocar.isPending ? 'Trocando...' : 'Confirmar troca'}
          </button>
        </div>
      </form>
    </div>
  );
}
