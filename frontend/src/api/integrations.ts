import api from './client';

export interface ApiKeyRow {
  id: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKeyRow {
  key: string;
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const { data } = await api.get<ApiKeyRow[]>('/integrations/api-keys');
  return data;
}

export async function createApiKey(label: string): Promise<CreatedApiKey> {
  const { data } = await api.post<CreatedApiKey>('/integrations/api-keys', { label });
  return data;
}

export async function deleteApiKey(id: string): Promise<void> {
  await api.delete(`/integrations/api-keys/${id}`);
}
