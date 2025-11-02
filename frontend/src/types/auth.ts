export interface User {
  id: number;
  username: string;
  email: string;
  email_verified?: boolean;
  password?: string;
  is_admin?: boolean;
  is_banned?: boolean;
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
  hcaptcha_token?: string;
  honeypot_value?: string;
}

export interface AuthResponse {
  user?: User;
  Token: string; // Backend uses capital T
  token?: string; // Keep lowercase for backward compatibility
}

export interface AuthError {
  message: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface Session {
  id: number;
  created_at: string;
  expires: string;
  is_current: boolean;
}

export interface SessionsListResponse {
  sessions: Session[];
}
