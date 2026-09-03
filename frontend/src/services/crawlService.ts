import axios from 'axios';
import { CrawlRequest, CrawlResponse, CrawlErrorResponse } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minute timeout for crawls
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Verify backend health status via GET /health.
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/health', { timeout: 5000 });
    return response.status === 200 && response.data?.status === 'healthy';
  } catch {
    return false;
  }
};

/**
 * Execute a website crawl request against POST /api/v1/crawl.
 *
 * @param request Crawl configuration parameters
 * @returns CrawlResponse containing summary metrics and discovered page lists
 */
export const startCrawl = async (request: CrawlRequest): Promise<CrawlResponse> => {
  try {
    const response = await apiClient.post<CrawlResponse>('/api/v1/crawl', {
      url: request.url,
      max_depth: request.max_depth,
      max_pages: request.max_pages,
      request_delay: request.request_delay ?? 0.1,
      respect_robots_txt: request.respect_robots_txt ?? true,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.data) {
        const errorData = error.response.data as CrawlErrorResponse;
        if (errorData.detail) {
          throw new Error(errorData.detail);
        }
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Crawl request timed out. Try reducing max pages or depth.');
      }
      if (error.message === 'Network Error') {
        throw new Error('Unable to connect to WebAtlas backend API. Please ensure backend is running.');
      }
      throw new Error(`Crawl request failed: ${error.message}`);
    }
    throw new Error('An unexpected error occurred while processing the crawl.');
  }
};
