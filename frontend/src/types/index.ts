export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  loginCount?: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
