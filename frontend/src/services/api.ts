import axios from 'axios';
import { HealthStatus } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchHealthStatus = async (): Promise<HealthStatus> => {
  try {
    const response = await apiClient.get<HealthStatus>('/health');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Failed to connect to backend health endpoint at ${API_BASE_URL}/health:`,
        error.message,
        error.code
      );
    } else {
      console.error('Unexpected error fetching health status:', error);
    }
    return {
      status: 'unhealthy',
      service: 'WebAtlas',
      version: '0.1.0',
      environment: 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
};
