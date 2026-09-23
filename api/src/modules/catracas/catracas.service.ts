import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { MetodoCheckIn, Prisma, Role, StatusAluno } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckInsService } from '../checkins/checkins.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import { ControlIdClient } from './controlid.provider';
import { CreateCatracaDto, UpdateCatracaDto } from './dto/catraca.dto';

const FOTO_DIR = join(process.cwd(), 'uploads', 'alunos');

// Usuário sintético: eventos da catraca não vêm de um operador logado.
// unidadeId null → não passa pelo escopo de recepção (a catraca já define
// a unidade física do acesso).
const USUARIO_CATRACA: AuthUser = {
  id: 'catraca',
  email: 'catraca@sistema.local',
  role: Role.ADMIN,
  unidadeId: null,
};

@Injectable()
export class CatracasService {
  private readonly logger = new Logger(CatracasService.name);

  constructor(
    private prisma: PrismaService,
    private checkIns: CheckInsService,
  ) {}

  // ---------- Dispositivos (admin) ----------

  findAll() {
    return this.prisma.catracaDispositivo.findMany({
      orderBy: { nome: 'asc' },
      include: { unidade: { select: { id: true, nome: true } } },
      omit: { senha: true },
    });
  }

  create(dto: CreateCatracaDto) {
    return this.prisma.catracaDispositivo.create({
      data: dto,
      omit: { senha: true },
      include: { unidade: { select: { id: true, nome: true } } },
    });
  }

  async update(id: string, dto: UpdateCatracaDto) {
    const disp = await this.prisma.catracaDispositivo.findUnique({
      where: { id },
    });
    if (!disp) throw new NotFoundException('Dispositivo não encontrado');
    return this.prisma.catracaDispositivo.update({
      where: { id },
      data: dto,
      omit: { senha: true },
      include: { unidade: { select: { id: true, nome: true } } },
    });
  }

  async remove(id: string) {
    const disp = await this.prisma.catracaDispositivo.findUnique({
      where: { id },
    });
    if (!disp) throw new NotFoundException('Dispositivo não encontrado');
    await this.prisma.catracaEvento.deleteMany({
      where: { dispositivoId: id },
    });
    await this.prisma.catracaDispositivo.delete({ where: { id } });
  }

  async eventos(dispositivoId: string) {
    return this.prisma.catracaEvento.findMany({
      where: { dispositivoId },
      include: { aluno: { select: { id: true, nome: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
  }

  private async client(id: string): Promise<{
    client: ControlIdClient;
    disp: { id: string; nome: string; unidadeId: string };
  }> {
    const disp = await this.prisma.catracaDispositivo.findUnique({
      where: { id },
    });
    if (!disp) throw new NotFoundException('Dispositivo não encontrado');
    return {
      client: new ControlIdClient(disp.url, disp.login, disp.senha),
      disp,
    };
  }

  async testar(id: string) {
    const { client, disp } = await this.client(id);
    try {
      await client.ping();
      return { ok: true, dispositivo: disp.nome };
    } catch (err) {
      return {
        ok: false,
        dispositivo: disp.nome,
        erro: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------- Webhook de eventos ----------

  async processarEvento(
    token: string,
    body: Record<string, unknown>,
    tipoQuery?: string,
  ) {
    const disp = await this.prisma.catracaDispositivo.findUnique({
      where: { token },
    });
    if (!disp || !disp.ativo) {
      throw new UnauthorizedException('Dispositivo inválido');
    }

    const num = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    };
    const catracaUserId =
      num(body.user_id) ?? num(body.usuario_id) ?? num(body.userId);
    const tipo = this.resolverTipo(body, tipoQuery);

    const registrar = async (
      alunoId: string | null,
      aceito: boolean,
      detalhe?: string,
    ) => {
      await this.prisma.catracaEvento.create({
        data: {
          dispositivoId: disp.id,
          alunoId,
          tipo,
          aceito,
          detalhe: detalhe?.slice(0, 500),
        },
      });
    };

    if (!catracaUserId) {
      await registrar(null, false, 'Evento sem identificação de usuário');
      return { ok: false, motivo: 'sem usuario' };
    }

    const aluno = await this.prisma.aluno.findUnique({
      where: { catracaId: catracaUserId },
    });
    if (!aluno) {
      await registrar(
        null,
        false,
        `Usuário ${catracaUserId} não vinculado a aluno`,
      );
      return { ok: false, motivo: 'aluno nao encontrado' };
    }

    try {
      if (tipo === 'SAIDA') {
        const aberto = await this.prisma.checkIn.findFirst({
          where: {
            alunoId: aluno.id,
            unidadeId: disp.unidadeId,
            saiuEm: null,
          },
          orderBy: { criadoEm: 'desc' },
        });
        if (!aberto) {
          await registrar(aluno.id, false, 'Sem check-in aberto para saída');
          return { ok: false, motivo: 'sem check-in aberto' };
        }
        await this.checkIns.registrarSaida(aberto.id, USUARIO_CATRACA);
      } else {
        await this.checkIns.create(
          {
            alunoId: aluno.id,
            unidadeId: disp.unidadeId,
            metodo: MetodoCheckIn.FACIAL,
          },
          USUARIO_CATRACA,
        );
      }
      await registrar(aluno.id, true);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await registrar(aluno.id, false, msg);
      this.logger.warn(
        `Evento ${tipo} recusado para aluno ${aluno.id}: ${msg}`,
      );
      return { ok: false, motivo: msg };
    }
  }

  private resolverTipo(
    body: Record<string, unknown>,
    tipoQuery?: string,
  ): 'ENTRADA' | 'SAIDA' {
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const bruto = (
      tipoQuery ??
      (str(body.tipo) || str(body.direction) || str(body.event))
    ).toLowerCase();
    if (/sa[ií]da|exit|egress/.test(bruto)) return 'SAIDA';
    return 'ENTRADA';
  }

  // ---------- Sincronização aluno → terminal ----------

  /**
   * Sincroniza um aluno nos terminais ativos da sua unidade.
   * - ATIVO + consentimento biometria → cria/atualiza usuário e foto
   * - INATIVO/SUSPENSO ou sem consentimento → remove do terminal
   * Nunca lança exceção para quem chamou via hook — retorna resultado.
   */
  async syncAluno(alunoId: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado');

    const dispositivos = await this.prisma.catracaDispositivo.findMany({
      where: { unidadeId: aluno.unidadeId, ativo: true },
    });
    if (dispositivos.length === 0) {
      return { alunoId, sincronizado: [], motivo: 'sem dispositivos' };
    }

    // Auto-atribui catracaId (próximo número livre) se o aluno ainda não tem.
    // Em P2002 (atribuição concorrente), recalcula e tenta mais uma vez.
    let catracaId = aluno.catracaId;
    if (catracaId == null) {
      for (let tentativa = 0; tentativa < 2 && catracaId == null; tentativa++) {
        try {
          const { _max } = await this.prisma.aluno.aggregate({
            _max: { catracaId: true },
          });
          catracaId = (_max.catracaId ?? 0) + 1;
          await this.prisma.aluno.update({
            where: { id: aluno.id },
            data: { catracaId },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            catracaId = null;
            continue;
          }
          throw e;
        }
      }
      if (catracaId == null) {
        throw new BadRequestException('Falha ao atribuir ID de catraca');
      }
    }

    const podeUsar =
      aluno.status === StatusAluno.ATIVO &&
      aluno.consentimentoBiometriaEm != null;

    const resultados: {
      dispositivo: string;
      ok: boolean;
      erro?: string;
    }[] = [];

    for (const disp of dispositivos) {
      const client = new ControlIdClient(disp.url, disp.login, disp.senha);
      try {
        if (podeUsar) {
          await client.upsertUsuario({
            id: catracaId,
            name: aluno.nome.slice(0, 100),
            registration: aluno.cpf,
          });
          const fotoPath = aluno.foto
            ? join(FOTO_DIR, basename(aluno.foto))
            : null;
          if (fotoPath && existsSync(fotoPath)) {
            const img = await readFile(fotoPath);
            await client.setImagem(catracaId, img);
          }
        } else {
          await client.removerUsuario(catracaId);
        }
        resultados.push({ dispositivo: disp.nome, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resultados.push({ dispositivo: disp.nome, ok: false, erro: msg });
        this.logger.warn(
          `Sync do aluno ${aluno.id} na catraca ${disp.nome}: ${msg}`,
        );
      }
    }
    return { alunoId, catracaId, sincronizado: resultados };
  }

  /** Versão fire-and-forget para hooks (create/update/foto) — nunca quebra a request. */
  syncAlunoSeguro(alunoId: string): void {
    this.syncAluno(alunoId).catch((err: unknown) =>
      this.logger.warn(
        `Sync de catraca falhou para aluno ${alunoId}: ${
          err instanceof Error ? err.message : err
        }`,
      ),
    );
  }

  /** Sincroniza todos os alunos consentidos de uma unidade num dispositivo. */
  async syncDispositivo(dispositivoId: string) {
    const { disp } = await this.client(dispositivoId);
    const alunos = await this.prisma.aluno.findMany({
      where: { unidadeId: disp.unidadeId },
      select: { id: true },
    });
    // Sequencial — paralelo causa corrida no auto-assign de catracaId e
    // sobrecarrega o terminal, que é lento por natureza.
    const resultados = [];
    for (const a of alunos) {
      resultados.push(await this.syncAluno(a.id));
    }
    return {
      dispositivo: disp.nome,
      total: resultados.length,
      falhas: resultados
        .flatMap((r) => r.sincronizado ?? [])
        .filter((r) => !r.ok),
    };
  }
}
