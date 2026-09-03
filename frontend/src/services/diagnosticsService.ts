import axios from 'axios';
import { DiagnosticsResponse } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch diagnostic health report for a stored crawl by crawl ID.
 */
export const fetchCrawlDiagnostics = async (crawlId: number): Promise<DiagnosticsResponse> => {
  try {
    const response = await apiClient.get<DiagnosticsResponse>(`/api/v1/crawls/${crawlId}/diagnostics`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to load health diagnostics for crawl #${crawlId}.`);
  }
};
