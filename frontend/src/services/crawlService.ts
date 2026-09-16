import axios from 'axios';
import { CrawlRequest, CrawlResponse, CrawlStatusResponse, CrawlErrorResponse } from '../types';

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

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
 * Enqueue a website crawl request against POST /api/v1/crawl.
 *
 * @param request Crawl configuration parameters
 * @returns CrawlResponse containing crawl session ID and QUEUED status
 */
export const startCrawl = async (request: CrawlRequest): Promise<CrawlResponse> => {
  try {
    const response = await apiClient.post<CrawlResponse>('/api/v1/crawl', {
      url: request.url,
      max_depth: request.max_depth,
      max_pages: request.max_pages,
      request_delay: request.request_delay ?? 0.1,
      respect_robots_txt: request.respect_robots_txt ?? true,
      render_mode: request.render_mode ?? 'auto',
      timeout: request.timeout ?? 10.0,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.data) {
        const errorData = error.response.data as CrawlErrorResponse;
        if (errorData.detail) {
          const detailStr = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          throw new Error(detailStr);
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

/**
 * Retrieve execution status and metric counters of a background crawl session via GET /api/v1/crawl/{crawl_id}/status.
 *
 * @param crawlId Database ID of the crawl session
 */
export const fetchCrawlStatus = async (crawlId: number): Promise<CrawlStatusResponse> => {
  const reqUrl = `${API_BASE_URL}/api/v1/crawl/${crawlId}/status`;
  try {
    const response = await apiClient.get<CrawlStatusResponse>(`/api/v1/crawl/${crawlId}/status`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const httpStatus = error.response?.status ?? 'NETWORK_ERROR';
      const respData = error.response?.data;
      const respBodyStr = respData ? JSON.stringify(respData) : 'No response body';
      
      console.error(
        `[CrawlStatus Check Failed] Requested URL: ${reqUrl} | Crawl ID: #${crawlId} | HTTP Status: ${httpStatus} | Response Body: ${respBodyStr}`
      );

      const detail = respData?.detail;
      if (detail) {
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        throw new Error(`[HTTP ${httpStatus}] ${detailStr}`);
      }

      if (error.message) {
        throw new Error(`[HTTP ${httpStatus}] ${error.message}`);
      }
    }
    console.error(`[CrawlStatus Check Failed] Requested URL: ${reqUrl} | Crawl ID: #${crawlId} | Error:`, error);
    throw new Error(`Failed to check status for crawl #${crawlId}.`);
  }
};
