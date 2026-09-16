import { Node, Edge, Position, MarkerType } from '@xyflow/react';
import { CrawlResponse, PageResponse } from '../types';

export interface SiteMapNodeData {
  title: string | null;
  url: string;
  normalizedUrl: string;
  parentUrl: string | null;
  statusCode: number | null;
  depth: number;
  isRoot: boolean;
  crawlSuccess: boolean;
  errorMessage: string | null;
  responseTime: number;
  internalLinksCount: number;
  externalLinksCount: number;
  primaryKeyword?: string | null;
  topic?: string | null;
  clusterId?: string | null;
  clusterName?: string | null;
  isDimmed: boolean;
  isMatched: boolean;
  page: PageResponse;
}

export interface GraphBuildResult {
  nodes: Node[];
  edges: Edge[];
  rootNodeId: string | null;
}

export interface FilterOptions {
  searchTerm?: string;
  statusFilter?: string;
  depthFilter?: string;
}

/**
 * Checks whether a given PageResponse matches active filters.
 */
export const isPageMatchingFilter = (page: PageResponse, filters?: FilterOptions): boolean => {
  if (!filters) return true;
  const { searchTerm, statusFilter, depthFilter } = filters;
  
  const hasSearch = !!(searchTerm && searchTerm.trim() !== '');
  const hasStatus = !!(statusFilter && statusFilter !== 'ALL');
  const hasDepth = !!(depthFilter && depthFilter !== 'ALL');

  if (!hasSearch && !hasStatus && !hasDepth) return true;

  const code = page.status_code;

  // 1. Status Filter Check
  if (hasStatus) {
    if (statusFilter === 'SUCCESS' && (!code || code < 200 || code >= 300)) return false;
    if (statusFilter === 'REDIRECT' && (!code || code < 300 || code >= 400)) return false;
    if (statusFilter === 'CLIENT_ERROR' && (!code || code < 400 || code >= 500)) return false;
    if (statusFilter === 'SERVER_ERROR' && (!code || code < 500 || code >= 600)) return false;
    if (statusFilter === 'CRAWL_ERROR' && (page.crawl_success && code && code < 400)) return false;
  }

  // 2. Depth Filter Check
  if (hasDepth) {
    const targetDepth = Number(depthFilter);
    if ((page.depth ?? 0) !== targetDepth) return false;
  }

  // 3. Search Term Check
  if (hasSearch) {
    const term = searchTerm!.toLowerCase().trim();
    const urlMatch = page.url.toLowerCase().includes(term);
    const titleMatch = !!(page.title && page.title.toLowerCase().includes(term));
    const statusMatch = !!(page.status_code && page.status_code.toString().includes(term));
    const kwMatch = !!(page.primary_keyword && page.primary_keyword.toLowerCase().includes(term));
    const topicMatch = !!(page.topic && page.topic.toLowerCase().includes(term));
    const clusterMatch = !!(page.cluster_id && page.cluster_id.toLowerCase().includes(term));
    if (!urlMatch && !titleMatch && !statusMatch && !kwMatch && !topicMatch && !clusterMatch) return false;
  }

  return true;
};

/**
 * Transforms backend CrawlResponse into React Flow Nodes and Edges
 * using a deterministic tree layout algorithm grouped by depth level.
 */
export const buildGraphFromCrawlResponse = (
  crawlData: CrawlResponse,
  filters?: FilterOptions
): GraphBuildResult => {
  if (!crawlData || !crawlData.pages || crawlData.pages.length === 0) {
    return { nodes: [], edges: [], rootNodeId: null };
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const processedNodeIds = new Set<string>();
  const processedEdgeKeys = new Set<string>();

  const normStartingUrl = crawlData.normalized_starting_url || crawlData.starting_url;

  // 1. Group pages by depth level
  const depthGroups: Map<number, PageResponse[]> = new Map();

  // Find or designate root page
  let rootPage = crawlData.pages.find(
    (p) => p.normalized_url === normStartingUrl || p.url === crawlData.starting_url
  );

  if (!rootPage && crawlData.pages.length > 0) {
    rootPage = crawlData.pages[0];
  }

  crawlData.pages.forEach((page) => {
    const depth = page.depth ?? 0;
    if (!depthGroups.has(depth)) {
      depthGroups.set(depth, []);
    }
    depthGroups.get(depth)!.push(page);
  });

  const hasActiveFilters = !!(
    (filters?.searchTerm && filters.searchTerm.trim() !== '') ||
    (filters?.statusFilter && filters.statusFilter !== 'ALL') ||
    (filters?.depthFilter && filters.depthFilter !== 'ALL')
  );

  // Layout Constants
  const NODE_WIDTH = 270;
  const NODE_GAP_X = 60;
  const LEVEL_HEIGHT_Y = 180;

  // 2. Compute tree layout positions level by level (sorting siblings by parent_url)
  depthGroups.forEach((pagesAtDepth, depth) => {
    pagesAtDepth.sort((a, b) => {
      const parentA = a.parent_url || '';
      const parentB = b.parent_url || '';
      return parentA.localeCompare(parentB);
    });

    const count = pagesAtDepth.length;
    const totalLevelWidth = count * NODE_WIDTH + (count - 1) * NODE_GAP_X;
    const startX = -totalLevelWidth / 2 + NODE_WIDTH / 2;

    pagesAtDepth.forEach((page, index) => {
      const nodeId = page.normalized_url || page.url;
      if (processedNodeIds.has(nodeId)) return;
      processedNodeIds.add(nodeId);

      const isRoot = page.normalized_url === normStartingUrl || page === rootPage;
      const posX = startX + index * (NODE_WIDTH + NODE_GAP_X);
      const posY = depth * LEVEL_HEIGHT_Y;

      const isMatched = isPageMatchingFilter(page, filters);
      const isDimmed = hasActiveFilters && !isMatched;

      const nodeData: SiteMapNodeData = {
        title: page.title,
        url: page.url,
        normalizedUrl: page.normalized_url,
        parentUrl: page.parent_url,
        statusCode: page.status_code,
        depth: page.depth,
        isRoot: isRoot,
        crawlSuccess: page.crawl_success,
        errorMessage: page.error_message,
        responseTime: page.response_time ?? 0,
        internalLinksCount: page.internal_links?.length || 0,
        externalLinksCount: page.external_links?.length || 0,
        primaryKeyword: page.primary_keyword,
        topic: page.topic,
        clusterId: page.cluster_id,
        clusterName: page.cluster_name,
        isDimmed: isDimmed,
        isMatched: isMatched,
        page: page,
      };

      nodes.push({
        id: nodeId,
        type: 'pageNode',
        position: { x: posX, y: posY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: nodeData as unknown as Record<string, unknown>,
      });
    });
  });

  // 3. Build directed parent -> child edges using parent_url
  const urlToNodeIdMap = new Map<string, string>();
  crawlData.pages.forEach((p) => {
    const id = p.normalized_url || p.url;
    urlToNodeIdMap.set(id, id);
    urlToNodeIdMap.set(p.url, id);
    if (p.normalized_url) urlToNodeIdMap.set(p.normalized_url, id);
  });

  crawlData.pages.forEach((page) => {
    const childId = page.normalized_url || page.url;
    if (!page.parent_url) return;

    const parentId = urlToNodeIdMap.get(page.parent_url);
    if (!parentId || parentId === childId) return;

    const edgeKey = `${parentId}->${childId}`;
    if (processedEdgeKeys.has(edgeKey)) return;
    processedEdgeKeys.add(edgeKey);

    const childMatched = isPageMatchingFilter(page, filters);
    const parentPage = crawlData.pages.find(p => (p.normalized_url || p.url) === parentId || p.url === parentId);
    const parentMatched = parentPage ? isPageMatchingFilter(parentPage, filters) : true;
    
    const edgeDimmed = hasActiveFilters && (!childMatched || !parentMatched);

    edges.push({
      id: edgeKey,
      source: parentId,
      target: childId,
      type: 'smoothstep',
      animated: !edgeDimmed,
      style: {
        stroke: edgeDimmed ? '#CBD8E6' : '#2563EB',
        strokeWidth: edgeDimmed ? 1.5 : 2,
        opacity: edgeDimmed ? 0.35 : 0.9,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edgeDimmed ? '#CBD8E6' : '#2563EB',
      },
    });
  });

  return {
    nodes,
    edges,
    rootNodeId: rootPage ? (rootPage.normalized_url || rootPage.url) : null,
  };
};

