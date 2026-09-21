import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/guards/jwt-auth.guard';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.auth.login(dto.email, dto.senha);
    this.setRefreshCookie(res, tokens);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string | undefined>)[
      REFRESH_COOKIE
    ];
    try {
      const { tokens, user } = await this.auth.refresh(token);
      this.setRefreshCookie(res, tokens);
      return { accessToken: tokens.accessToken, user };
    } catch (err) {
      // Token inválido/expirado/reusado: limpa o cookie morto para que o
      // browser não continue reenviando-o em tentativas futuras.
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[
      REFRESH_COOKIE
    ];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private setRefreshCookie(res: Response, tokens: TokenPair) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      expires: tokens.refreshExpiresAt,
    });
  }
}
