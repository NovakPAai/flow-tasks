import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '/api';

// Access token lives only in memory — never in localStorage/sessionStorage
let inMemoryToken: string | null = null;
// In-flight refresh promise — deduplicates concurrent proactive refresh calls
let proactiveRefreshPromise: Promise<void> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

export function getAccessToken() {
  return inMemoryToken;
}

function parseJwtExpiry(token: string): number | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as Record<string, unknown>;
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function proactiveRefresh(): Promise<void> {
  if (!inMemoryToken) return;
  const exp = parseJwtExpiry(inMemoryToken);
  if (!exp) return;
  const secsLeft = exp - Math.floor(Date.now() / 1000);
  if (secsLeft > 5 * 60) return;

  if (!proactiveRefreshPromise) {
    proactiveRefreshPromise = axios
      .post<{ accessToken: string }>(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => { inMemoryToken = data.accessToken; })
      .finally(() => { proactiveRefreshPromise = null; });
  }
  await proactiveRefreshPromise;
}

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send HttpOnly refresh token cookie automatically
});

api.interceptors.request.use(async (config) => {
  if (inMemoryToken && !config.url?.includes('/auth/refresh')) {
    await proactiveRefresh().catch(() => {}); // best-effort; 401 handler is the safety net
  }
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    // config.url holds only the path (not baseURL), so this match is reliable
    const isRefreshEndpoint = original.url?.includes('/auth/refresh');
    const PUBLIC_PATHS = ['/login', '/register', '/reset-password', '/forgot-password'];
    if (error.response?.status === 401 && !original._retry && !isRefreshEndpoint) {
      original._retry = true;
      try {
        const { data } = await axios.post<{ accessToken: string }>(
          `${apiBaseUrl}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        inMemoryToken = data.accessToken;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        inMemoryToken = null;
        if (!PUBLIC_PATHS.includes(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
