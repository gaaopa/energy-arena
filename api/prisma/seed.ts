import {
  MetodoPagamento,
  PeriodoPlano,
  PrismaClient,
  Role,
  StatusPagamento,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const diasAtras = (dias: number) =>
  new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

// IDs fixos em formato UUID: mantêm o seed idempotente (upsert por id)
// e passam no ParseUUIDPipe dos controllers.
const UID = {
  unidade1: '00000000-0000-4000-8000-000000000001',
  unidade2: '00000000-0000-4000-8000-000000000002',
  planoMensal: '00000000-0000-4000-8000-000000000101',
  planoRecorrente: '00000000-0000-4000-8000-000000000102',
  planoSemestral: '00000000-0000-4000-8000-000000000104',
  planoAnual: '00000000-0000-4000-8000-000000000103',
};
const seedId = (grupo: number, seq: number) =>
  `00000000-0000-4000-8000-${String(grupo * 1000 + seq).padStart(12, '0')}`;

async function main() {
  const unidade1 = await prisma.unidade.upsert({
    where: { id: UID.unidade1 },
    update: { nome: 'Riachuelo' },
    create: {
      id: UID.unidade1,
      nome: 'Riachuelo',
      endereco: 'Rua 24 de Maio, 489 — Riachuelo',
      telefone: '(21) 3333-1000',
    },
  });
  const unidade2 = await prisma.unidade.upsert({
    where: { id: UID.unidade2 },
    update: { nome: 'Unidade 2' },
    create: {
      id: UID.unidade2,
      nome: 'Unidade 2',
      endereco: 'Endereço da segunda unidade',
      telefone: '(21) 3333-2000',
    },
  });

  const senhaHash = await bcrypt.hash(
    process.env.SEED_ADMIN_SENHA ?? 'Admin@12345',
    12,
  );
  await prisma.usuario.upsert({
    where: { email: 'admin@academia.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@academia.com',
      senhaHash,
      role: Role.ADMIN,
    },
  });

  const staffHash = await bcrypt.hash('Recep@12345', 12);
  await prisma.usuario.upsert({
    where: { email: 'recepcao.centro@academia.com' },
    update: {},
    create: {
      nome: 'Recepção Centro',
      email: 'recepcao.centro@academia.com',
      senhaHash: staffHash,
      role: Role.RECEPCAO,
      unidadeId: unidade1.id,
    },
  });
  await prisma.usuario.upsert({
    where: { email: 'recepcao.norte@academia.com' },
    update: {},
    create: {
      nome: 'Recepção Norte',
      email: 'recepcao.norte@academia.com',
      senhaHash: staffHash,
      role: Role.RECEPCAO,
      unidadeId: unidade2.id,
    },
  });
  await prisma.usuario.upsert({
    where: { email: 'instrutor@academia.com' },
    update: {},
    create: {
      nome: 'Carlos Instrutor',
      email: 'instrutor@academia.com',
      senhaHash: staffHash,
      role: Role.INSTRUTOR,
    },
  });

  const planoMensal = await prisma.plano.upsert({
    where: { id: UID.planoMensal },
    update: { nome: 'Mensalidade', valor: 159.0, periodo: PeriodoPlano.MENSAL },
    create: {
      id: UID.planoMensal,
      nome: 'Mensalidade',
      descricao: 'Musculação + aulas coletivas',
      valor: 159.0,
      periodo: PeriodoPlano.MENSAL,
    },
  });
  const planoRecorrente = await prisma.plano.upsert({
    where: { id: UID.planoRecorrente },
    update: {
      nome: 'Recorrente',
      valor: 143.0,
      periodo: PeriodoPlano.MENSAL,
      recorrente: true,
    },
    create: {
      id: UID.planoRecorrente,
      nome: 'Recorrente',
      descricao: 'Cartão de crédito recorrente',
      valor: 143.0,
      periodo: PeriodoPlano.MENSAL,
      recorrente: true,
    },
  });
  const planoSemestral = await prisma.plano.upsert({
    where: { id: UID.planoSemestral },
    update: { nome: 'Semestral', valor: 139.0, periodo: PeriodoPlano.SEMESTRAL },
    create: {
      id: UID.planoSemestral,
      nome: 'Semestral',
      descricao: 'Crédito e cheque — R$ 139/mês',
      valor: 139.0,
      periodo: PeriodoPlano.SEMESTRAL,
    },
  });
  const planoAnual = await prisma.plano.upsert({
    where: { id: UID.planoAnual },
    update: { nome: 'Anual', valor: 130.0, periodo: PeriodoPlano.ANUAL, multiUnidade: true },
    create: {
      id: UID.planoAnual,
      nome: 'Anual',
      descricao: 'Crédito e cheque — R$ 130/mês',
      valor: 130.0,
      periodo: PeriodoPlano.ANUAL,
      multiUnidade: true,
    },
  });

  const alunosSeed = [
    { nome: 'Ana Souza', cpf: '11111111111', unidade: unidade1, plano: planoMensal, pagoDias: 5 },
    { nome: 'Bruno Lima', cpf: '22222222222', unidade: unidade1, plano: planoMensal, pagoDias: 12 },
    { nome: 'Carla Mendes', cpf: '33333333333', unidade: unidade1, plano: planoSemestral, pagoDias: 20 },
    { nome: 'Diego Ferreira', cpf: '44444444444', unidade: unidade1, plano: planoAnual, pagoDias: 30 },
    { nome: 'Elisa Rocha', cpf: '55555555555', unidade: unidade1, plano: planoMensal, pagoDias: null },
    { nome: 'Felipe Santos', cpf: '66666666666', unidade: unidade2, plano: planoRecorrente, pagoDias: 3 },
    { nome: 'Gabriela Costa', cpf: '77777777777', unidade: unidade2, plano: planoSemestral, pagoDias: 45 },
    { nome: 'Henrique Alves', cpf: '88888888888', unidade: unidade2, plano: planoAnual, pagoDias: 60 },
    { nome: 'Isabela Martins', cpf: '99999999999', unidade: unidade2, plano: planoMensal, pagoDias: null },
    { nome: 'João Pereira', cpf: '12345678901', unidade: unidade1, plano: planoRecorrente, pagoDias: 8 },
    { nome: 'Karen Oliveira', cpf: '23456789012', unidade: unidade2, plano: planoMensal, pagoDias: 15 },
    { nome: 'Lucas Rodrigues', cpf: '34567890123', unidade: unidade1, plano: planoSemestral, pagoDias: null },
  ];

  for (const [i, a] of alunosSeed.entries()) {
    const aluno = await prisma.aluno.upsert({
      where: { cpf: a.cpf },
      update: {},
      create: {
        nome: a.nome,
        cpf: a.cpf,
        email: `${a.nome.split(' ')[0].toLowerCase()}@email.com`,
        telefone: `(11) 9${8000 + i}-0000`,
        dataNascimento: new Date(1990 + (i % 15), i % 12, (i % 27) + 1),
        unidadeId: a.unidade.id,
        // Todo aluno seedado ganha matrícula logo abaixo — e matrícula
        // carrega consentimento de biometria (regra desde 2026-09-22)
        consentimentoBiometriaEm: new Date(),
      },
    });

    const inicio = diasAtras(30 + i * 5);
    const fimCiclo = new Date(inicio);
    fimCiclo.setMonth(
      fimCiclo.getMonth() +
        { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }[a.plano.periodo],
    );
    // Recorrente: sem dataFim; a renovação é a primeira fronteira de
    // ciclo no futuro (o aluno seedado está com os ciclos quitados)
    const recorrente = a.plano.recorrente;
    const renovacao = new Date(fimCiclo);
    if (recorrente) {
      const agora = new Date();
      while (renovacao <= agora) {
        renovacao.setMonth(renovacao.getMonth() + 1);
      }
    }

    const matricula = await prisma.matricula.upsert({
      where: { id: seedId(1, i) },
      update: {
        planoId: a.plano.id,
        unidadeId: a.unidade.id,
        valor: a.plano.valor,
        dataFim: recorrente ? null : fimCiclo,
        proximaRenovacao: recorrente ? renovacao : null,
      },
      create: {
        id: seedId(1, i),
        alunoId: aluno.id,
        planoId: a.plano.id,
        unidadeId: a.unidade.id,
        dataInicio: inicio,
        dataFim: recorrente ? null : fimCiclo,
        proximaRenovacao: recorrente ? renovacao : null,
        valor: a.plano.valor,
      },
    });

    const pago = a.pagoDias !== null;
    if (recorrente) {
      // Ciclo anterior quitado + próxima cobrança PENDENTE na renovação,
      // igual ao que marcarPago() gera no runtime
      const cicloQuitado = new Date(renovacao);
      cicloQuitado.setMonth(cicloQuitado.getMonth() - 1);
      if (pago) {
        await prisma.pagamento.upsert({
          where: { id: seedId(2, i) },
          update: { valor: a.plano.valor },
          create: {
            id: seedId(2, i),
            matriculaId: matricula.id,
            valor: a.plano.valor,
            vencimento: cicloQuitado,
            pagoEm: cicloQuitado,
            metodo: MetodoPagamento.CARTAO_CREDITO,
            status: StatusPagamento.PAGO,
          },
        });
      }
      await prisma.pagamento.upsert({
        where: { id: seedId(4, i) },
        update: { valor: a.plano.valor },
        create: {
          id: seedId(4, i),
          matriculaId: matricula.id,
          valor: a.plano.valor,
          vencimento: renovacao,
          status: StatusPagamento.PENDENTE,
        },
      });
    } else {
      await prisma.pagamento.upsert({
        where: { id: seedId(2, i) },
        update: { valor: a.plano.valor },
        create: {
          id: seedId(2, i),
          matriculaId: matricula.id,
          valor: a.plano.valor,
          vencimento: pago ? diasAtras(a.pagoDias) : diasAtras(-10 - i),
          pagoEm: pago ? diasAtras(a.pagoDias) : null,
          metodo: pago
            ? [MetodoPagamento.PIX, MetodoPagamento.CARTAO_CREDITO][i % 2]
            : null,
          status: pago ? StatusPagamento.PAGO : StatusPagamento.PENDENTE,
        },
      });
    }

    // Histórico de check-ins (entrada + saída) para a aba Frequência:
    // 8–20 acessos nos últimos ~50 dias, permanência de 45–110 min
    const totalCks = 8 + ((i * 7) % 13);
    for (let j = 0; j < totalCks; j++) {
      const dia = Math.floor((j * 50) / totalCks); // espalha ~50 dias
      const hora = 6 + ((i * 3 + j * 5) % 16); // 6h–21h
      const entrada = diasAtras(dia);
      entrada.setHours(hora, (i * 11 + j * 17) % 60, 0, 0);
      const saida = new Date(entrada);
      saida.setMinutes(saida.getMinutes() + 45 + ((i * 13 + j * 7) % 66));

      await prisma.checkIn.upsert({
        where: { id: seedId(3, i * 40 + j) },
        update: { saiuEm: saida },
        create: {
          id: seedId(3, i * 40 + j),
          alunoId: aluno.id,
          unidadeId: a.unidade.id,
          criadoEm: entrada,
          saiuEm: saida,
        },
      });
    }
  }

  const counts = {
    alunos: await prisma.aluno.count(),
    matriculas: await prisma.matricula.count(),
    pagamentos: await prisma.pagamento.count(),
    checkIns: await prisma.checkIn.count(),
  };
  console.log('Seed concluído:', counts);
  console.log('Logins: admin@academia.com/Admin@12345 · recepcao.centro@academia.com/Recep@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
