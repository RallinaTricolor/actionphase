import axios from 'axios';

// Simple API client without complex typing
const api = axios.create({
  baseURL: '', // Use proxy in development
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Simple API functions
export const simpleApi = {
  async ping() {
    return api.get('/ping');
  },

  async login(username: string, password: string) {
    return api.post('/api/v1/auth/login', { username, password });
  },

  async register(username: string, email: string, password: string) {
    return api.post('/api/v1/auth/register', { username, email, password });
  },

  async refreshToken() {
    return api.get('/api/v1/auth/refresh');
  },

  // Games API
  async getPublicGames() {
    return api.get('/api/v1/games/public');
  },

  async getGame(gameId: string) {
    return api.get(`/api/v1/games/${gameId}`);
  },

  async createGame(gameData: any) {
    return api.post('/api/v1/games', gameData);
  },

  // Dashboard API
  async getDashboard() {
    return api.get('/api/v1/dashboard');
  },
};
