/** System Health Status Interface */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

/** Crawl Status State */
export type CrawlStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

/** Render Mode options supported by WebAtlas crawler */
export type RenderMode = 'auto' | 'httpx' | 'playwright';

/** Crawl Request Payload sent to POST /api/v1/crawl */
export interface CrawlRequest {
  url: string;
  max_depth: number;
  max_pages: number;
  request_delay?: number;
  respect_robots_txt?: boolean;
  timeout?: number;
  render_mode?: RenderMode;
}

/** Discovered Page representation returned by backend */
export interface PageResponse {
  url: string;
  normalized_url: string;
  parent_url: string | null;
  depth: number;
  title: string | null;
  status_code: number | null;
  content_type: string | null;
  internal_links: string[];
  external_links: string[];
  meta_description?: string | null;
  h1?: string | null;
  headings?: string[];
  main_text?: string | null;
  primary_keyword?: string | null;
  related_keywords?: string[];
  keyword_score?: number | null;
  topic?: string | null;
  cluster_id?: string | null;
  cluster_name?: string | null;
  crawl_success: boolean;
  error_message: string | null;
  response_time: number;
  discovered_at: string;
}

/** Page keyword summary item returned by GET /api/v1/crawls/{id}/keywords */
export interface PageKeywordSummary {
  url: string;
  title?: string | null;
  primary_keyword?: string | null;
  related_keywords: string[];
  keyword_score?: number | null;
  topic?: string | null;
  cluster_id?: string | null;
  cluster_name?: string | null;
}

/** Lightweight page item inside cluster details */
export interface ClusterPageItem {
  url: string;
  title?: string | null;
  primary_keyword?: string | null;
  topic?: string | null;
}

/** Topic cluster detail model */
export interface ClusterDetail {
  cluster_id: string;
  cluster_name: string;
  cluster_primary_topic: string;
  keywords: string[];
  page_count: number;
  pages: ClusterPageItem[];
}

/** Keywords response model returned by backend GET /api/v1/crawls/{id}/keywords */
export interface CrawlKeywordsResponse {
  crawl_id: number;
  starting_url: string;
  domain: string;
  total_pages_analyzed: number;
  keywords: PageKeywordSummary[];
}

/** Cluster summary response returned by backend GET /api/v1/crawls/{id}/clusters */
export interface ClusterSummaryResponse {
  crawl_id: number;
  starting_url: string;
  domain: string;
  total_pages_analyzed: number;
  total_clusters: number;
  clusters: ClusterDetail[];
}

/** Complete summary report returned by backend POST /api/v1/crawl or GET /api/v1/crawls/{id} */
export interface CrawlResponse {
  crawl_id?: number | null;
  task_id?: string | null;
  status?: string;
  starting_url: string;
  normalized_starting_url: string;
  domain: string;
  total_pages: number;
  successful_pages: number;
  failed_pages: number;
  total_internal_links: number;
  total_external_links: number;
  max_depth_reached: number;
  pages: PageResponse[];
  errors: string[];
  duration_seconds: number;
  completed_at: string;
}

/** Detailed progress and execution status returned by GET /api/v1/crawl/{crawl_id}/status */
export interface CrawlStatusResponse {
  crawl_id: number;
  task_id?: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  starting_url: string;
  domain: string;
  pages_discovered: number;
  pages_crawled: number;
  pages_failed: number;
  successful_pages: number;
  current_depth: number;
  max_depth: number;
  max_pages: number;
  progress_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  error?: string | null;
  errors: string[];
  duration_seconds: number;
}

/** Summary item returned by GET /api/v1/crawls history listing */
export interface CrawlHistoryItem {
  crawl_id: number;
  starting_url: string;
  normalized_starting_url: string;
  domain: string;
  total_pages: number;
  successful_pages: number;
  failed_pages: number;
  duration_seconds: number;
  created_at: string;
}

/** Response payload returned when deleting a crawl */
export interface DeleteCrawlResponse {
  message: string;
  crawl_id: number;
}

/** Error payload returned by backend when crawl fails */
export interface CrawlErrorResponse {
  detail: string;
}

/** Diagnostic Issue Item */
export interface DiagnosticIssue {
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  message: string;
  affected_count: number;
  affected_urls: string[];
}

/** Health Score Point Deduction Entry */
export interface ScoreDeduction {
  reason: string;
  deduction: number;
}

/** HTTP Status Code Distribution */
export interface StatusDistribution {
  count_2xx: number;
  count_3xx: number;
  count_4xx: number;
  count_5xx: number;
  count_other: number;
  exact_status_counts: Record<string, number>;
}

/** Comprehensive Link Statistics */
export interface LinkStatistics {
  total_internal_links: number;
  unique_internal_links: number;
  verified_internal_ok: number;
  verified_internal_broken: number;
  unverified_internal: number;
  total_external_links: number;
  unique_external_links: number;
  unverified_external: number;
}

/** Depth Distribution Statistics */
export interface DepthStatistics {
  min_depth: number;
  max_depth_reached: number;
  average_depth: number;
  depth_counts: Record<string, number>;
}

/** HTML Title Statistics */
export interface TitleStatistics {
  total_with_title: number;
  missing_title_count: number;
  duplicate_title_count: number;
  missing_title_urls: string[];
  duplicate_title_groups: Record<string, string[]>;
}

/** Complete Website Health Diagnostics Report */
export interface DiagnosticsResponse {
  crawl_id: number | null;
  starting_url: string;
  domain: string;
  health_score: number;
  health_status: 'Excellent' | 'Good' | 'Needs Attention' | 'Poor';
  total_pages: number;
  successful_pages: number;
  failed_pages: number;
  score_breakdown: ScoreDeduction[];
  status_distribution: StatusDistribution;
  link_statistics: LinkStatistics;
  depth_statistics: DepthStatistics;
  title_statistics: TitleStatistics;
  potential_orphans_count: number;
  potential_orphan_urls: string[];
  robots_blocked_count: number;
  issues: DiagnosticIssue[];
}
