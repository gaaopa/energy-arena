import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatusMatricula, StatusPagamento } from '@prisma/client';
import { MatriculasService } from '../src/modules/matriculas/matriculas.service';
import {
  admin,
  catracasEspia,
  novaMatricula,
  novaUnidade,
  novoAluno,
  novoPagamento,
  novoPlano,
  prisma,
  recepcao,
  diasAdiante,
} from './helpers';

const svc = () => {
  const { catracas, sincronizados } = catracasEspia();
  return {
    matriculas: new MatriculasService(prisma, catracas),
    sincronizados,
  };
};

after(() => prisma.$disconnect());

describe('matriculas.create — consentimento', () => {
  test('carimba consentimento e dispara sync na primeira matrícula', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas, sincronizados } = svc();

    await matriculas.create(
      {
        alunoId: a.id,
        planoId: p.id,
        unidadeId: u.id,
        dataInicio: '2026-09-01',
      },
      admin,
    );

    const depois = await prisma.aluno.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.ok(depois.consentimentoBiometriaEm);
    assert.ok(
      Math.abs(depois.consentimentoBiometriaEm.getTime() - Date.now()) <
        60_000,
      'consentimento deve ser carimbado agora, não com outra data',
    );
    assert.deepEqual(sincronizados, [a.id]);
  });

  test('não sobrescreve consentimento existente nem ressincroniza', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const antigo = new Date('2025-01-10T12:00:00Z');
    const a = await novoAluno(u.id, { consentimento: antigo });
    const { matriculas, sincronizados } = svc();

    await matriculas.create(
      {
        alunoId: a.id,
        planoId: p.id,
        unidadeId: u.id,
        dataInicio: '2026-09-01',
      },
      admin,
    );

    const depois = await prisma.aluno.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.equal(depois.consentimentoBiometriaEm?.getTime(), antigo.getTime());
    assert.equal(sincronizados.length, 0);
  });

  test('segunda matrícula ativa para o mesmo aluno é rejeitada', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas } = svc();
    const dto = {
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      dataInicio: '2026-09-01',
    };
    await matriculas.create(dto, admin);
    await assert.rejects(matriculas.create(dto, admin), BadRequestException);
  });

  test('recepção de outra unidade recebe Forbidden', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas } = svc();

    await assert.rejects(
      matriculas.create(
        {
          alunoId: a.id,
          planoId: p.id,
          unidadeId: u.id,
          dataInicio: '2026-09-01',
        },
        recepcao(outra.id),
      ),
      ForbiddenException,
    );
  });
});

describe('matriculas.cancelar', () => {
  test('ATIVA vira INATIVA e pendências viram CANCELADO na mesma operação', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas } = svc();
    const m = await matriculas.create(
      {
        alunoId: a.id,
        planoId: p.id,
        unidadeId: u.id,
        dataInicio: '2026-09-01',
      },
      admin,
    );
    await novoPagamento(m.id, { vencimento: diasAdiante(30) });
    await novoPagamento(m.id, {
      vencimento: diasAdiante(60),
      status: StatusPagamento.PAGO,
    });

    const r = await matriculas.cancelar(m.id, admin);
    assert.equal(r.status, StatusMatricula.INATIVA);

    const pags = await prisma.pagamento.findMany({
      where: { matriculaId: m.id },
    });
    const porStatus = new Map(pags.map((pg) => [pg.status, pg]));
    assert.equal(
      pags.filter((pg) => pg.status === StatusPagamento.PENDENTE).length,
      0,
    );
    assert.equal(
      pags.filter((pg) => pg.status === StatusPagamento.CANCELADO).length,
      2,
    );
    assert.ok(porStatus.get(StatusPagamento.PAGO));

    // Contrato atual: cancelar não revoga consentimento (revogação é backlog)
    const aluno = await prisma.aluno.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.ok(aluno.consentimentoBiometriaEm);
  });

  test('segundo cancelamento devolve BadRequest', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas } = svc();
    const m = await matriculas.create(
      {
        alunoId: a.id,
        planoId: p.id,
        unidadeId: u.id,
        dataInicio: '2026-09-01',
      },
      admin,
    );
    await matriculas.cancelar(m.id, admin);
    await assert.rejects(matriculas.cancelar(m.id, admin), BadRequestException);
  });

  test('recepção de outra unidade recebe NotFound', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const { matriculas } = svc();
    const m = await matriculas.create(
      {
        alunoId: a.id,
        planoId: p.id,
        unidadeId: u.id,
        dataInicio: '2026-09-01',
      },
      admin,
    );
    await assert.rejects(
      matriculas.cancelar(m.id, recepcao(outra.id)),
      NotFoundException,
    );
  });
});

describe('matriculas.trocarPlano', () => {
  test('troca carimba consentimento de quem não tinha e inativa a antiga', async () => {
    const u = await novaUnidade();
    const p1 = await novoPlano();
    const p2 = await novoPlano();
    const a = await novoAluno(u.id);
    // Fixture bypassa o service: matrícula ativa sem consentimento
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p1.id,
      unidadeId: u.id,
    });
    await novoPagamento(m.id); // pendência da matrícula antiga
    const { matriculas, sincronizados } = svc();

    const nova = await matriculas.trocarPlano(m.id, { planoId: p2.id }, admin);
    assert.equal(nova.status, StatusMatricula.ATIVA);
    assert.equal(nova.plano.id, p2.id);

    const antiga = await prisma.matricula.findUniqueOrThrow({
      where: { id: m.id },
    });
    assert.equal(antiga.status, StatusMatricula.INATIVA);

    // pendências da antiga canceladas; a nova nasce com 1 cobrança PENDENTE
    assert.equal(
      await prisma.pagamento.count({
        where: { matriculaId: m.id, status: StatusPagamento.CANCELADO },
      }),
      1,
    );
    assert.equal(
      await prisma.pagamento.count({
        where: { matriculaId: nova.id, status: StatusPagamento.PENDENTE },
      }),
      1,
    );

    const depois = await prisma.aluno.findUniqueOrThrow({
      where: { id: a.id },
    });
    assert.ok(depois.consentimentoBiometriaEm);
    assert.ok(
      Math.abs(depois.consentimentoBiometriaEm.getTime() - Date.now()) <
        60_000,
      'consentimento deve ser carimbado agora, não com outra data',
    );
    assert.deepEqual(sincronizados, [a.id]);
  });

  test('recepção de outra unidade recebe NotFound', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p1 = await novoPlano();
    const p2 = await novoPlano();
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p1.id,
      unidadeId: u.id,
    });
    const { matriculas } = svc();
    await assert.rejects(
      matriculas.trocarPlano(m.id, { planoId: p2.id }, recepcao(outra.id)),
      NotFoundException,
    );
  });

  test('trocar para o mesmo plano devolve BadRequest', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    const m = await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const { matriculas } = svc();
    await assert.rejects(
      matriculas.trocarPlano(m.id, { planoId: p.id }, admin),
      BadRequestException,
    );
  });
});
