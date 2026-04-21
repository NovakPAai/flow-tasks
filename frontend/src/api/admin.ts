import api from './client';
import type { AdminUser, RegistrationRequest } from '../types';

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>('/admin/users');
  return data;
}

export async function createUser(name: string, emailPrefix: string): Promise<{ user: AdminUser; generatedPassword: string }> {
  const { data } = await api.post<{ user: AdminUser; generatedPassword: string }>('/admin/users', { name, emailPrefix });
  return data;
}

export async function listRegistrationRequests(): Promise<RegistrationRequest[]> {
  const { data } = await api.get<RegistrationRequest[]>('/admin/registration-requests');
  return data;
}

export async function reviewRegistrationRequest(id: string, action: 'approve' | 'reject'): Promise<void> {
  await api.patch(`/admin/registration-requests/${id}`, { action });
}

export async function setUserSuperadmin(userId: string, isSuperadmin: boolean): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/admin/users/${userId}`, { isSuperadmin });
  return data;
}
