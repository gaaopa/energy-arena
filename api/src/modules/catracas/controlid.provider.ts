// Cliente HTTP para a API local do terminal Control iD (iDFace / iDAccess).
// Referência: API web do equipamento — endpoints *.fcgi com sessão obtida
// via /login.fcgi. O terminal roda na LAN da unidade; timeouts curtos
// evitam travar a request se a catraca estiver offline.
export interface ControlIdUsuario {
  id: number;
  name: string;
  registration?: string;
}

const TIMEOUT_MS = 8_000;

export class ControlIdClient {
  private session: { token: string; expiraEm: number } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly login: string,
    private readonly senha: string,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async post<T>(
    path: string,
    body: unknown,
    comSessao = true,
  ): Promise<T> {
    const session = comSessao ? `?session=${await this.getSession()}` : '';
    const res = await fetch(this.url(`${path}${session}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    // Sessão expirada no meio do caminho: renova e tenta uma vez
    if (res.status === 401 && comSessao) {
      this.session = null;
      return this.post(path, body, comSessao);
    }
    if (!res.ok) {
      throw new Error(
        `Control iD ${path} → ${res.status}: ${JSON.stringify(data)}`,
      );
    }
    return data as T;
  }

  private async getSession(): Promise<string> {
    if (this.session && this.session.expiraEm > Date.now() + 5_000) {
      return this.session.token;
    }
    const res = await fetch(this.url('/login.fcgi'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: this.login, password: this.senha }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Login no terminal falhou (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { session?: string };
    if (!data.session) throw new Error('Terminal não retornou sessão');
    // Sessões do iDFace expiram (~15 min) — margem de segurança de 10 min
    this.session = { token: data.session, expiraEm: Date.now() + 10 * 60_000 };
    return data.session;
  }

  /** Testa conectividade + credenciais do terminal. */
  async ping(): Promise<void> {
    await this.getSession();
  }

  /** Cria o usuário no terminal; se já existir, atualiza nome/registro. */
  async upsertUsuario(usuario: ControlIdUsuario): Promise<void> {
    try {
      await this.post('/create_objects.fcgi', {
        object: 'users',
        values: [usuario],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/exist|duplicate|unique|409/i.test(msg)) throw err;
      await this.post('/modify_objects.fcgi', {
        object: 'users',
        values: usuario,
        where: [{ users: { id: usuario.id } }],
      });
    }
  }

  /** Remove o usuário do terminal (aluno bloqueado/inativo). */
  async removerUsuario(userId: number): Promise<void> {
    await this.post('/destroy_objects.fcgi', {
      object: 'users',
      where: [{ users: { id: userId } }],
    });
  }

  /**
   * Envia a foto para geração do template facial do usuário.
   * Endpoint binário do iDFace; exige imagem frontal nítida (JPG/PNG).
   */
  async setImagem(userId: number, imagem: Buffer): Promise<void> {
    const session = await this.getSession();
    const res = await fetch(
      this.url(`/user_set_image.fcgi?session=${session}&user_id=${userId}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(imagem),
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
      },
    );
    if (!res.ok) {
      throw new Error(`Envio de foto ao terminal falhou (HTTP ${res.status})`);
    }
  }
}
