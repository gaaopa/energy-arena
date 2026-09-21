import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  // Tetos defensivos: access token nunca deve viver mais de 24h
  // (a rotação via refresh token existe justamente para mantê-lo curto)
  JWT_ACCESS_TTL: z.coerce.number().int().positive().max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(7),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${parsed.error.message}`);
  }
  return parsed.data;
}
