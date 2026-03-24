import axios from 'axios';
import { AuthResponse, DashboardMetrics } from '../types';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Adicionar token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', { name, email, password });
    return response.data;
  },
};

export const metricsService = {
  getDashboard: async (): Promise<DashboardMetrics> => {
    const response = await api.get<DashboardMetrics>('/metrics/dashboard');
    return response.data;
  },

  getRecentSales: async (limit: number = 10) => {
    const response = await api.get(`/metrics/sales/recent?limit=${limit}`);
    return response.data;
  },
};

export default api;