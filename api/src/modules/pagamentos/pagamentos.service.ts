import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusPagamento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';
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
      include: { matricula: { select: { unidadeId: true } } },
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
      // Condição no WHERE torna a transição PENDENTE → PAGO atômica
      return await this.prisma.pagamento.update({
        where: { id, status: StatusPagamento.PENDENTE },
        data: {
          status: StatusPagamento.PAGO,
          metodo: dto.metodo,
          referencia: dto.referencia,
          pagoEm: new Date(),
        },
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
