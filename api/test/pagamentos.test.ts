import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  MetodoPagamento,
  StatusMatricula,
  StatusPagamento,
} from '@prisma/client';
import { PagamentosService } from '../src/modules/pagamentos/pagamentos.service';
import {
  addMeses,
  admin,
  novaMatricula,
  novaUnidade,
  novoAluno,
  novoPagamento,
  novoPlano,
  prisma,
  recepcao,
} from './helpers';

const pagamentos = new PagamentosService(prisma);

after(() => prisma.$disconnect());

describe('pagamentos.marcarPago', () => {
  test('plano recorrente: baixa gera próximo ciclo e avança renovação', async () => {
    const u = await novaUnidade();
    const p = await novoPlano({ recorrente: true });
    const a = await novoAluno(u.id);
    const v1 = new Date('2026-09-01T00:00:00Z');
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      proximaRenovacao: v1,
    });
    const pg = await novoPagamento(m.id, { vencimento: v1 });

    await pagamentos.marcarPago(
      pg.id,
      { metodo: MetodoPagamento.PIX },
      admin,
    );

    const pags = await prisma.pagamento.findMany({
      where: { matriculaId: m.id },
      orderBy: { vencimento: 'asc' },
    });
    assert.equal(pags.length, 2);
    assert.equal(pags[0].status, StatusPagamento.PAGO);
    assert.equal(pags[0].metodo, MetodoPagamento.PIX);
    assert.ok(pags[0].pagoEm);
    assert.equal(pags[1].status, StatusPagamento.PENDENTE);
    assert.equal(pags[1].vencimento.getTime(), addMeses(v1, 1).getTime());
    // ciclo novo herda o valor do pagamento baixado
    assert.equal(String(pags[1].valor), String(pags[0].valor));

    const depois = await prisma.matricula.findUniqueOrThrow({
      where: { id: m.id },
    });
    assert.equal(depois.proximaRenovacao?.getTime(), addMeses(v1, 1).getTime());
  });

  test('baixa fora de ordem não regride proximaRenovacao', async () => {
    const u = await novaUnidade();
    const p = await novoPlano({ recorrente: true });
    const a = await novoAluno(u.id);
    const v1 = new Date('2026-08-01T00:00:00Z');
    const v2 = new Date('2026-09-01T00:00:00Z');
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      proximaRenovacao: v2,
    });
    const p1 = await novoPagamento(m.id, { vencimento: v1 });
    const p2 = await novoPagamento(m.id, { vencimento: v2 });

    // Paga o ciclo mais novo primeiro: renovação avança para v2+1m
    await pagamentos.marcarPago(p2.id, { metodo: MetodoPagamento.PIX }, admin);
    // Depois paga o ciclo antigo: renovação não pode voltar para v1+1m
    await pagamentos.marcarPago(p1.id, { metodo: MetodoPagamento.PIX }, admin);

    const depois = await prisma.matricula.findUniqueOrThrow({
      where: { id: m.id },
    });
    assert.equal(depois.proximaRenovacao?.getTime(), addMeses(v2, 1).getTime());

    const pags = await prisma.pagamento.findMany({
      where: { matriculaId: m.id },
    });
    // p1, p2 pagos + 1 ciclo novo em v2+1m; sem duplicar o ciclo v1+1m (=v2)
    assert.equal(pags.length, 3);
    assert.equal(
      pags.filter((pg) => pg.status === StatusPagamento.PENDENTE).length,
      1,
    );
  });

  test('segunda baixa no mesmo pagamento devolve BadRequest', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const pg = await novoPagamento(m.id);
    await pagamentos.marcarPago(pg.id, { metodo: MetodoPagamento.PIX }, admin);
    await assert.rejects(
      pagamentos.marcarPago(
        pg.id,
        { metodo: MetodoPagamento.DINHEIRO },
        admin,
      ),
      BadRequestException,
    );
  });

  test('plano não recorrente: baixa não cria ciclo novo', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      dataFim: new Date('2027-09-01T00:00:00Z'),
    });
    const pg = await novoPagamento(m.id);
    await pagamentos.marcarPago(pg.id, { metodo: MetodoPagamento.PIX }, admin);

    const total = await prisma.pagamento.count({
      where: { matriculaId: m.id },
    });
    assert.equal(total, 1);
    const depois = await prisma.matricula.findUniqueOrThrow({
      where: { id: m.id },
    });
    assert.equal(depois.proximaRenovacao, null);
  });

  test('baixa em matrícula inativa não gera ciclo novo', async () => {
    const u = await novaUnidade();
    const p = await novoPlano({ recorrente: true });
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      status: StatusMatricula.INATIVA,
      proximaRenovacao: new Date('2026-09-01T00:00:00Z'),
    });
    // Pendente "fantasma": cancelar() zera as pendências na mesma tx, mas
    // uma que escape não deve renascer a matrícula parada
    const pg = await novoPagamento(m.id, {
      vencimento: new Date('2026-09-01T00:00:00Z'),
    });
    await pagamentos.marcarPago(pg.id, { metodo: MetodoPagamento.PIX }, admin);

    const total = await prisma.pagamento.count({
      where: { matriculaId: m.id },
    });
    assert.equal(total, 1);
    const depois = await prisma.matricula.findUniqueOrThrow({
      where: { id: m.id },
    });
    assert.equal(depois.proximaRenovacao?.getTime(), new Date('2026-09-01T00:00:00Z').getTime());
  });

  test('recepção de outra unidade recebe NotFound', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const pg = await novoPagamento(m.id);
    await assert.rejects(
      pagamentos.marcarPago(
        pg.id,
        { metodo: MetodoPagamento.PIX },
        recepcao(outra.id),
      ),
      NotFoundException,
    );
  });
});
