import api from './client';
import type { AuthResponse, User } from '../types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function register(email: string, password: string, name: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/register', { email, password, name });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function updateProfile(data: { name?: string; email?: string }): Promise<User> {
  const { data: user } = await api.patch<User>('/auth/me', data);
  return user;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
  return data;
}

export async function getRegistrationDomain(): Promise<string> {
  const { data } = await api.get<{ domain: string }>('/auth/registration-domain');
  return data.domain;
}
