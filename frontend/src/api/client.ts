import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '/api';

// Access token lives only in memory — never in localStorage/sessionStorage
let inMemoryToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

export function getAccessToken() {
  return inMemoryToken;
}

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send HttpOnly refresh token cookie automatically
});

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
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
      } catch {
        inMemoryToken = null;
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
