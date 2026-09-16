import axios from 'axios';
import { CrawlKeywordsResponse, ClusterSummaryResponse, ClusterDetail } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Retrieve extracted keyword mapping for a crawl session via GET /api/v1/crawls/{crawl_id}/keywords.
 */
export const fetchCrawlKeywords = async (crawlId: number): Promise<CrawlKeywordsResponse> => {
  try {
    const response = await apiClient.get<CrawlKeywordsResponse>(`/api/v1/crawls/${crawlId}/keywords`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to fetch keyword mapping for crawl #${crawlId}.`);
  }
};

/**
 * Retrieve all topic clusters for a crawl session via GET /api/v1/crawls/{crawl_id}/clusters.
 */
export const fetchCrawlClusters = async (crawlId: number): Promise<ClusterSummaryResponse> => {
  try {
    const response = await apiClient.get<ClusterSummaryResponse>(`/api/v1/crawls/${crawlId}/clusters`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to fetch topic clusters for crawl #${crawlId}.`);
  }
};

/**
 * Retrieve specific topic cluster details via GET /api/v1/crawls/{crawl_id}/clusters/{cluster_id}.
 */
export const fetchClusterById = async (crawlId: number, clusterId: string): Promise<ClusterDetail> => {
  try {
    const response = await apiClient.get<ClusterDetail>(`/api/v1/crawls/${crawlId}/clusters/${clusterId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(`Failed to fetch cluster '${clusterId}' for crawl #${crawlId}.`);
  }
};
