import axios from 'axios';
import { CrawlHistoryItem, CrawlResponse, DeleteCrawlResponse } from '../types';

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
 * Fetch lightweight historical crawl summaries from GET /api/v1/crawls.
 */
export const fetchCrawlHistory = async (limit: number = 100): Promise<CrawlHistoryItem[]> => {
  try {
    const response = await apiClient.get<CrawlHistoryItem[]>('/api/v1/crawls', {
      params: { limit },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch crawl history:', error);
    return [];
  }
};

/**
 * Fetch complete historical crawl details & pages by ID from GET /api/v1/crawls/{crawlId}.
 */
export const fetchCrawlById = async (crawlId: number): Promise<CrawlResponse> => {
  try {
    const response = await apiClient.get<CrawlResponse>(`/api/v1/crawls/${crawlId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to load saved crawl #${crawlId} from database.`);
  }
};

/**
 * Delete a historical crawl session from database via DELETE /api/v1/crawls/{crawlId}.
 */
export const deleteCrawlById = async (crawlId: number): Promise<DeleteCrawlResponse> => {
  try {
    const response = await apiClient.delete<DeleteCrawlResponse>(`/api/v1/crawls/${crawlId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to delete crawl #${crawlId}.`);
  }
};
