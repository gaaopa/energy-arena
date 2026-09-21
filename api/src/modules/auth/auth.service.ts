import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Usuario } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

// Hash bcrypt (custo 12, mesmo do cadastro) usado para equalizar o tempo de
// resposta do login quando o usuário não existe — evita enumeração de e-mails
// via timing side-channel.
const DUMMY_SENHA_HASH =
  '$2b$12$OYO3bBXrRxP/CzdwwFG6p.cFz1Q7q1w2qO2na/J4vCWCnzU6GtIw2';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(
    email: string,
    senha: string,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    // Normaliza aqui também: o service não deve depender do @Transform do DTO
    const emailNormalizado = email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });

    // bcrypt.compare sempre executa (mesmo sem usuário) para não vazar via
    // timing se o e-mail existe/está ativo.
    const senhaOk = await bcrypt.compare(
      senha,
      usuario?.senhaHash ?? DUMMY_SENHA_HASH,
    );
    if (!usuario || !usuario.ativo || !senhaOk) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.issueTokens(usuario);
    return { tokens, user: this.toAuthUser(usuario) };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{ tokens: TokenPair; user: AuthUser }> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Token já rotacionado sendo reapresentado: possível roubo/replay.
    // Revoga toda a família de tokens do usuário (força re-login).
    if (stored.revogadoEm) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: stored.usuarioId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Usuário desativado: revoga a família para que tokens antigos não
    // "ressuscitem" caso a conta seja reativada depois.
    if (!stored.usuario.ativo) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: stored.usuarioId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (stored.expiraEm < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Rotação: revoga o token usado e emite um novo par. O updateMany
    // condicional (revogadoEm: null) é atômico — se uma requisição
    // concorrente já rotacionou este token, count === 0 e a transação
    // aborta, evitando a emissão de dois pares para o mesmo token.
    const tokens = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: stored.id, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      if (revoked.count === 0) {
        throw new UnauthorizedException('Refresh token inválido ou expirado');
      }
      return this.issueTokens(stored.usuario, tx);
    });

    return { tokens, user: this.toAuthUser(stored.usuario) };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  private async issueTokens(
    usuario: Usuario,
    tx?: Prisma.TransactionClient,
  ): Promise<TokenPair> {
    const prisma = tx ?? this.prisma;

    const accessToken = await this.jwt.signAsync(
      {
        sub: usuario.id,
        email: usuario.email,
        role: usuario.role,
        unidadeId: usuario.unidadeId,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL'),
      },
    );

    const refreshToken = randomBytes(64).toString('base64url');
    const ttlDays = this.config.getOrThrow<number>('JWT_REFRESH_TTL_DAYS');
    const refreshExpiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    );

    await prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        usuarioId: usuario.id,
        expiraEm: refreshExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(usuario: Usuario): AuthUser {
    return {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      unidadeId: usuario.unidadeId,
    };
  }
}
