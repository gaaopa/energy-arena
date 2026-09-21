import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, refreshAccessToken, tokenStore } from './api';

export type Role = 'ADMIN' | 'RECEPCAO' | 'INSTRUTOR' | 'ALUNO';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  unidadeId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    const finalizar = () => {
      if (ativo) setLoading(false);
    };

    async function restaurar() {
      try {
        // Sem access token no storage, o cookie httpOnly de refresh
        // ainda pode restaurar a sessão.
        if (!tokenStore.get()) await refreshAccessToken();
        const res = await api.get<AuthUser>('/auth/me');
        if (ativo) setUser(res.data);
      } catch {
        tokenStore.clear();
      } finally {
        finalizar();
      }
    }

    void restaurar();
    return () => {
      ativo = false;
    };
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      { email, senha },
    );
    tokenStore.set(res.data.accessToken);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
