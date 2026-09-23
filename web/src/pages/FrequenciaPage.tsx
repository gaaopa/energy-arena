import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface RelatorioAluno {
  alunoId: string;
  nome: string;
  totalAcessos: number;
  acessosMesAtual: number;
  mediaAcessosMes: number;
  permanenciaMediaMin: number | null;
  primeiroAcesso: string;
  ultimoAcesso: string;
  diasVinculo: number;
}

interface Resumo {
  alunosComAcesso: number;
  totalAcessos: number;
  acessosMesAtual: number;
  mediaAcessosMesAluno: number;
  permanenciaMediaMin: number | null;
}

interface Relatorio {
  geral: Resumo;
  unidades: {
    unidadeId: string;
    nome: string;
    resumo: Resumo;
    alunos: RelatorioAluno[];
  }[];
}

function fmtMin(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function TabelaAlunos({ alunos }: { alunos: RelatorioAluno[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3">Aluno</th>
            <th className="px-4 py-3 text-right">Acessos no mês</th>
            <th className="px-4 py-3 text-right">Média/mês</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Permanência média</th>
            <th className="px-4 py-3">Primeiro acesso</th>
            <th className="px-4 py-3">Último acesso</th>
            <th className="px-4 py-3 text-right">Vínculo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {alunos.map((a) => (
            <tr key={a.alunoId} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium text-zinc-900">{a.nome}</td>
              <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                {a.acessosMesAtual}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600">
                {String(a.mediaAcessosMes).replace('.', ',')}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600">
                {a.totalAcessos}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600">
                {fmtMin(a.permanenciaMediaMin)}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {fmtData(a.primeiroAcesso)}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {fmtData(a.ultimoAcesso)}
              </td>
              <td className="px-4 py-3 text-right text-zinc-600">
                {a.diasVinculo}d
              </td>
            </tr>
          ))}
          {alunos.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                Nenhum acesso registrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function FrequenciaPage() {
  const [busca, setBusca] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['checkins', 'relatorio'],
    queryFn: async () => (await api.get<Relatorio>('/checkins/relatorio')).data,
  });

  if (isLoading) return <p className="text-zinc-500">Carregando...</p>;
  if (isError || !data) {
    return <p className="text-red-600">Erro ao carregar frequência.</p>;
  }

  const { geral } = data;
  const termo = busca.toLowerCase();
  const unidades = data.unidades
    .map((u) => ({
      ...u,
      alunos: u.alunos.filter((a) => a.nome.toLowerCase().includes(termo)),
    }))
    .filter((u) => !termo || u.alunos.length > 0);

  const cards = [
    { label: 'Alunos com acesso', valor: String(geral.alunosComAcesso) },
    { label: 'Acessos no mês', valor: String(geral.acessosMesAtual) },
    {
      label: 'Média de acessos/mês por aluno',
      valor: String(geral.mediaAcessosMesAluno).replace('.', ','),
    },
    {
      label: 'Permanência média por acesso',
      valor: fmtMin(geral.permanenciaMediaMin),
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Frequência</h2>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink">
              {c.valor}
            </p>
          </div>
        ))}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar aluno..."
        className="mb-4 w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2"
      />

      <div className="space-y-8">
        {unidades.map((u) => (
          <section key={u.unidadeId}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="text-lg font-semibold text-zinc-900">{u.nome}</h3>
              <p className="text-xs text-zinc-500">
                {u.resumo.alunosComAcesso} alunos ·{' '}
                {u.resumo.acessosMesAtual} acessos no mês · média{' '}
                {String(u.resumo.mediaAcessosMesAluno).replace('.', ',')}/mês ·
                permanência {fmtMin(u.resumo.permanenciaMediaMin)}
              </p>
            </div>
            <TabelaAlunos alunos={u.alunos} />
          </section>
        ))}
        {unidades.length === 0 && (
          <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
            Nenhum acesso encontrado.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Permanência média considera apenas acessos com saída registrada. Aluno
        com plano multi-unidade aparece em cada unidade com os acessos dela.
      </p>
    </div>
  );
}
