import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

const TOKEN_KEY = 'gym.accessToken';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= api
    .post<{ accessToken: string }>('/auth/refresh')
    .then((res) => {
      tokenStore.set(res.data.accessToken);
      return res.data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// 401 nesses endpoints não significa "access token expirado":
// login = credenciais inválidas; refresh = cookie inválido (retry seria loop);
// logout é público e não deve disparar refresh.
const NO_REFRESH_URLS = ['/auth/login', '/auth/refresh', '/auth/logout'];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const skipRefresh = NO_REFRESH_URLS.includes(original?.url ?? '');
    if (error.response?.status !== 401 || !original || original._retried || skipRefresh) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      await refreshAccessToken();
      return api(original);
    } catch {
      tokenStore.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  },
);
