import axios from 'axios';
import { logger, setCorrelationId } from '@/services/LoggingService';

// Simple API client without complex typing
const api = axios.create({
  baseURL: '', // Use proxy in development
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token and log requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log API requests in development
    logger.debug('API Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
    });

    return config;
  },
  (error) => {
    logger.error('API Request Error', { error });
    return Promise.reject(error);
  }
);

// Add response interceptor to extract correlation IDs and log responses
api.interceptors.response.use(
  (response) => {
    // Extract correlation ID from response headers
    const correlationId =
      response.headers['x-correlation-id'] ||
      response.headers['x-request-id'] ||
      null;

    if (correlationId) {
      setCorrelationId(correlationId);
    }

    // Log successful API responses in development
    logger.debug('API Response', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      correlationId,
    });

    return response;
  },
  (error) => {
    // Extract correlation ID from error response if available
    const correlationId =
      error.response?.headers?.['x-correlation-id'] ||
      error.response?.headers?.['x-request-id'] ||
      null;

    if (correlationId) {
      setCorrelationId(correlationId);
    }

    // Log API errors
    logger.error('API Error', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorMessage: error.message,
      correlationId,
    });

    return Promise.reject(error);
  }
);

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
