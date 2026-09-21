import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CheckIn {
  id: string;
  criadoEm: string;
  aluno: { id: string; nome: string };
  unidade: { id: string; nome: string };
}

export function DashboardPage() {
  const { data: checkins, isPending, isError } = useQuery({
    queryKey: ['checkins', 'hoje'],
    queryFn: async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const res = await api.get<CheckIn[]>('/checkins', {
        params: { de: hoje.toISOString() },
      });
      return res.data;
    },
  });

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Check-ins hoje</p>
          <p className="mt-1 text-3xl font-bold">{checkins?.length ?? '—'}</p>
        </div>
      </div>
      <h3 className="mb-2 mt-8 text-lg font-semibold">Últimos check-ins</h3>
      {isError && (
        <p className="mb-2 text-sm text-red-600">
          Erro ao carregar check-ins.
        </p>
      )}
      <ul className="divide-y divide-zinc-200 rounded-xl bg-white shadow-sm">
        {isPending && (
          <li className="px-5 py-3 text-sm text-zinc-500">Carregando...</li>
        )}
        {(checkins ?? []).slice(0, 10).map((c) => (
          <li key={c.id} className="flex justify-between px-5 py-3 text-sm">
            <span>{c.aluno.nome}</span>
            <span className="text-zinc-500">
              {c.unidade.nome} · {new Date(c.criadoEm).toLocaleTimeString('pt-BR')}
            </span>
          </li>
        ))}
        {checkins?.length === 0 && (
          <li className="px-5 py-3 text-sm text-zinc-500">
            Nenhum check-in hoje.
          </li>
        )}
      </ul>
    </div>
  );
}
