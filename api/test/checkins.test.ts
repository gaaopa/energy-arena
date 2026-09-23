import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MetodoCheckIn, StatusAluno } from '@prisma/client';
import { CheckInsService } from '../src/modules/checkins/checkins.service';
import {
  admin,
  diasAdiante,
  diasAtras,
  novaMatricula,
  novaUnidade,
  novoAluno,
  novoPlano,
  prisma,
  recepcao,
} from './helpers';

const checkins = new CheckInsService(prisma);

after(() => prisma.$disconnect());

describe('checkins.create — bloqueios', () => {
  test('matrícula com cobrança em aberto (renovação vencida) bloqueia', async () => {
    const u = await novaUnidade();
    const p = await novoPlano({ recorrente: true });
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      proximaRenovacao: diasAtras(1),
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, admin),
      ForbiddenException,
    );
  });

  test('matrícula que só começa amanhã bloqueia hoje', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      dataInicio: diasAdiante(1),
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, admin),
      ForbiddenException,
    );
  });

  test('matrícula com dataFim passada bloqueia', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      dataFim: diasAtras(1),
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, admin),
      ForbiddenException,
    );
  });

  test('recepção só registra check-in na própria unidade', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, recepcao(outra.id)),
      ForbiddenException,
    );
  });

  test('aluno inativo bloqueia mesmo com matrícula ativa', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id, { status: StatusAluno.INATIVO });
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, admin),
      ForbiddenException,
    );
  });

  test('aluno sem nenhuma matrícula bloqueia', async () => {
    const u = await novaUnidade();
    const a = await novoAluno(u.id);
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u.id }, admin),
      ForbiddenException,
    );
  });
});

describe('checkins.create — acesso e dedupe', () => {
  test('em dia cria check-in e reescaneio em 5min devolve o mesmo', async () => {
    const u = await novaUnidade();
    const p = await novoPlano({ recorrente: true });
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
      proximaRenovacao: diasAdiante(15),
    });
    const c1 = await checkins.create({ alunoId: a.id, unidadeId: u.id }, admin);
    const c2 = await checkins.create(
      { alunoId: a.id, unidadeId: u.id, metodo: MetodoCheckIn.MANUAL },
      admin,
    );
    assert.equal(c2.id, c1.id);
    assert.equal(
      await prisma.checkIn.count({ where: { alunoId: a.id } }),
      1,
    );
  });

  test('check-in mais velho que a janela de 5min não deduplica', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const antigo = await prisma.checkIn.create({
      data: {
        alunoId: a.id,
        unidadeId: u.id,
        criadoEm: new Date(Date.now() - 6 * 60_000),
      },
    });
    const c = await checkins.create({ alunoId: a.id, unidadeId: u.id }, admin);
    assert.notEqual(c.id, antigo.id);
    assert.equal(
      await prisma.checkIn.count({ where: { alunoId: a.id } }),
      2,
    );
  });

  test('plano não multi-unidade bloqueia check-in em outra unidade', async () => {
    const u = await novaUnidade();
    const u2 = await novaUnidade();
    const p = await novoPlano({ multiUnidade: false });
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    await assert.rejects(
      checkins.create({ alunoId: a.id, unidadeId: u2.id }, admin),
      ForbiddenException,
    );
  });

  test('plano multi-unidade libera check-in em outra unidade', async () => {
    const u = await novaUnidade();
    const u2 = await novaUnidade();
    const p = await novoPlano({ multiUnidade: true });
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const c = await checkins.create({ alunoId: a.id, unidadeId: u2.id }, admin);
    assert.equal(c.unidadeId, u2.id);
  });

  test('dedupe é por unidade: mesmo aluno em outra unidade cria check-in novo', async () => {
    const u = await novaUnidade();
    const u2 = await novaUnidade();
    const p = await novoPlano({ multiUnidade: true });
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const c1 = await checkins.create({ alunoId: a.id, unidadeId: u.id }, admin);
    const c2 = await checkins.create({ alunoId: a.id, unidadeId: u2.id }, admin);
    assert.notEqual(c2.id, c1.id);
  });
});

describe('checkins.registrarSaida', () => {
  test('segunda saída no mesmo check-in devolve BadRequest', async () => {
    const u = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const c = await checkins.create({ alunoId: a.id, unidadeId: u.id }, admin);
    const saida = await checkins.registrarSaida(c.id, admin);
    assert.ok(saida.saiuEm);
    await assert.rejects(
      checkins.registrarSaida(c.id, admin),
      BadRequestException,
    );
  });

  test('recepção de outra unidade recebe NotFound', async () => {
    const u = await novaUnidade();
    const outra = await novaUnidade();
    const p = await novoPlano();
    const a = await novoAluno(u.id);
    await novaMatricula({
      alunoId: a.id,
      planoId: p.id,
      unidadeId: u.id,
    });
    const c = await checkins.create({ alunoId: a.id, unidadeId: u.id }, admin);
    await assert.rejects(
      checkins.registrarSaida(c.id, recepcao(outra.id)),
      NotFoundException,
    );
  });
});
