export interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user?: User;
  Token: string; // Backend uses capital T
  token?: string; // Keep lowercase for backward compatibility
}

export interface AuthError {
  message: string;
}
