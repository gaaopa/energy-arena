import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusMatricula, StatusPagamento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
import { PERIODO_MESES } from '../planos/periodo';
import { PagarDto, QueryPagamentosDto } from './dto/pagamento.dto';

@Injectable()
export class PagamentosService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryPagamentosDto, user: AuthUser) {
    // Recepção vê apenas pagamentos da própria unidade
    const unidadeId = user.unidadeId ?? query.unidadeId;
    const where: Prisma.PagamentoWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.matriculaId ? { matriculaId: query.matriculaId } : {}),
      ...(unidadeId ? { matricula: { unidadeId } } : {}),
    };
    return this.prisma.pagamento.findMany({
      where,
      include: {
        matricula: {
          include: {
            aluno: { select: { id: true, nome: true } },
            unidade: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { vencimento: 'desc' },
    });
  }

  async marcarPago(id: string, dto: PagarDto, user: AuthUser) {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id },
      include: {
        matricula: {
          select: {
            id: true,
            unidadeId: true,
            status: true,
            plano: { select: { recorrente: true, periodo: true } },
          },
        },
      },
    });
    // Recepção só baixa pagamentos da própria unidade
    if (
      !pagamento ||
      (user.unidadeId && pagamento.matricula.unidadeId !== user.unidadeId)
    ) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    if (pagamento.status !== StatusPagamento.PENDENTE) {
      throw new BadRequestException(
        'Somente pagamentos pendentes podem ser baixados',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serializa com cancelar() por matrícula: quem segurar o lock
        // primeiro define o estado que o outro enxerga.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pagamento.matricula.id}))`;

        // Condição no WHERE torna a transição PENDENTE → PAGO atômica
        const pago = await tx.pagamento.update({
          where: { id, status: StatusPagamento.PENDENTE },
          data: {
            status: StatusPagamento.PAGO,
            metodo: dto.metodo,
            referencia: dto.referencia,
            pagoEm: new Date(),
          },
        });

        // Plano recorrente: o pagamento quita um ciclo e já agenda o próximo.
        // proximaRenovacao acompanha o vencimento da cobrança mais recente.
        const matricula = pagamento.matricula;
        if (matricula.plano.recorrente) {
          // Status re-lido dentro da tx + lock: decisão sobre estado atual,
          // não sobre a leitura pré-transação (race com cancelar())
          const atual = await tx.matricula.findUnique({
            where: { id: matricula.id },
            select: { status: true },
          });
          if (atual?.status === StatusMatricula.ATIVA) {
            const novaRenovacao = new Date(pagamento.vencimento);
            novaRenovacao.setMonth(
              novaRenovacao.getMonth() + PERIODO_MESES[matricula.plano.periodo],
            );
            // Consulta antes de criar: P2002 dentro da tx interativa abortaria
            // tudo (25P02). Sob o lock da matrícula, check-then-create é seguro
            // — só este fluxo escreve cobranças de ciclo desta matrícula.
            const cicloExiste = await tx.pagamento.findUnique({
              where: {
                matriculaId_vencimento: {
                  matriculaId: matricula.id,
                  vencimento: novaRenovacao,
                },
              },
              select: { id: true },
            });
            if (!cicloExiste) {
              await tx.pagamento.create({
                data: {
                  matriculaId: matricula.id,
                  valor: pago.valor,
                  vencimento: novaRenovacao,
                },
              });
            }
            try {
              // Só avança para frente: pagamento fora de ordem não regride
              // a renovação; cancelamento concorrente cai no P2025.
              await tx.matricula.update({
                where: {
                  id: matricula.id,
                  status: StatusMatricula.ATIVA,
                  OR: [
                    { proximaRenovacao: null },
                    { proximaRenovacao: { lt: novaRenovacao } },
                  ],
                },
                data: { proximaRenovacao: novaRenovacao },
              });
            } catch (e) {
              if (
                !(
                  e instanceof Prisma.PrismaClientKnownRequestError &&
                  e.code === 'P2025'
                )
              ) {
                throw e;
              }
            }
          }
        }

        return pago;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new BadRequestException(
          'Somente pagamentos pendentes podem ser baixados',
        );
      }
      throw e;
    }
  }
}
