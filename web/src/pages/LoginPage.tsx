import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSubmitting(true);
    try {
      await login(email, senha);
      navigate('/', { replace: true });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      setErro(
        status === 401
          ? 'E-mail ou senha inválidos'
          : 'Erro ao entrar. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <span className="text-muted">Carregando...</span>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-base px-4">
      {/* brilho ambiente laranja, como o letreiro da fachada */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(55%_100%_at_50%_0%,rgb(201_123_78/0.16),transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm text-muted">
            Sistema de gestão — acesso restrito
          </p>
        </div>
        {/* faixa de LED */}
        <div className="h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
        <form
          onSubmit={onSubmit}
          className="rounded-b-2xl border border-t-0 border-line bg-surface p-8 shadow-2xl"
        >
          <label className="mb-4 block text-sm font-medium text-ink">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-base px-3 py-2 text-ink"
            />
          </label>
          <label className="mb-4 block text-sm font-medium text-ink">
            Senha
            <input
              type="password"
              required
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-base px-3 py-2 text-ink"
            />
          </label>
          {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand py-2.5 font-semibold text-black shadow-[0_0_28px_-6px_rgb(249_115_22/0.55)] transition hover:bg-orange-400 disabled:opacity-50"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
