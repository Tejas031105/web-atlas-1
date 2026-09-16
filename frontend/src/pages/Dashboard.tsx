import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '../components/Header';
import { UrlInput } from '../components/UrlInput';
import { StatsOverview } from '../components/StatsOverview';
import { DiagnosticsOverview } from '../components/DiagnosticsOverview';
import { SiteMap } from '../components/SiteMap';
import { PageDetailsPanel } from '../components/PageDetailsPanel';
import { CrawlResultsTable, StatusFilterType } from '../components/CrawlResultsTable';
import { CrawlHistoryTable } from '../components/CrawlHistoryTable';
import { ExportCard } from '../components/ExportCard';
import { CrawlProgressCard } from '../components/CrawlProgressCard';
import { useCrawlStatus } from '../hooks/useCrawlStatus';
import { startCrawl } from '../services/crawlService';
import { fetchCrawlHistory, fetchCrawlById, deleteCrawlById } from '../services/historyService';
import { fetchCrawlDiagnostics } from '../services/diagnosticsService';
import { SEOClustersOverview } from '../components/SEOClustersOverview';
import { fetchCrawlClusters } from '../services/clusterService';
import { CrawlRequest, CrawlResponse, PageResponse, CrawlHistoryItem, DiagnosticsResponse, ClusterSummaryResponse } from '../types';
import { AlertCircle, Database, Zap } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [crawlResult, setCrawlResult] = useState<CrawlResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [clustersData, setClustersData] = useState<ClusterSummaryResponse | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageResponse | null>(null);
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState<boolean>(false);
  const [clustersLoading, setClustersLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [isHistoricalView, setIsHistoricalView] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Background Job Polling States
  const [activeCrawlId, setActiveCrawlId] = useState<number | null>(null);
  const [isPollingActive, setIsPollingActive] = useState<boolean>(false);

  const { statusData, error: statusError, isPolling } = useCrawlStatus(
    activeCrawlId,
    isPollingActive
  );

  // Synchronized Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [depthFilter, setDepthFilter] = useState<string>('ALL');

  const hasActiveFilters = !!(
    (searchTerm && searchTerm.trim() !== '') ||
    (statusFilter && statusFilter !== 'ALL') ||
    (depthFilter && depthFilter !== 'ALL')
  );

  const filteredPages = useMemo(() => {
    if (!crawlResult || !crawlResult.pages) return [];
    return crawlResult.pages.filter((p) => {
      const code = p.status_code;
      if (statusFilter === 'SUCCESS' && (!code || code < 200 || code >= 300)) return false;
      if (statusFilter === 'REDIRECT' && (!code || code < 300 || code >= 400)) return false;
      if (statusFilter === 'CLIENT_ERROR' && (!code || code < 400 || code >= 500)) return false;
      if (statusFilter === 'SERVER_ERROR' && (!code || code < 500 || code >= 600)) return false;
      if (statusFilter === 'CRAWL_ERROR' && (p.crawl_success && code && code < 400)) return false;

      if (depthFilter !== 'ALL' && (p.depth ?? 0) !== Number(depthFilter)) return false;

      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const urlMatch = p.url.toLowerCase().includes(term);
        const titleMatch = !!(p.title && p.title.toLowerCase().includes(term));
        const statusMatch = !!(p.status_code && p.status_code.toString().includes(term));
        const kwMatch = !!(p.primary_keyword && p.primary_keyword.toLowerCase().includes(term));
        const topicMatch = !!(p.topic && p.topic.toLowerCase().includes(term));
        if (!urlMatch && !titleMatch && !statusMatch && !kwMatch && !topicMatch) return false;
      }

      return true;
    });
  }, [crawlResult, statusFilter, depthFilter, searchTerm]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const data = await fetchCrawlHistory();
    setHistory(data);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadDiagnosticsForCrawl = useCallback(async (crawlId: number) => {
    setDiagnosticsLoading(true);
    try {
      const diagData = await fetchCrawlDiagnostics(crawlId);
      setDiagnostics(diagData);
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  const loadClustersForCrawl = useCallback(async (crawlId: number) => {
    setClustersLoading(true);
    try {
      const clData = await fetchCrawlClusters(crawlId);
      setClustersData(clData);
    } catch (err) {
      console.error('Failed to load topic clusters:', err);
    } finally {
      setClustersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (crawlResult && crawlResult.crawl_id) {
      loadDiagnosticsForCrawl(crawlResult.crawl_id);
      loadClustersForCrawl(crawlResult.crawl_id);
    } else {
      setDiagnostics(null);
      setClustersData(null);
    }
  }, [crawlResult, loadDiagnosticsForCrawl, loadClustersForCrawl]);

  // Handle completion/failure transitions from polling hook
  useEffect(() => {
    if (!statusData || !activeCrawlId) return;

    if (statusData.status === 'COMPLETED') {
      setIsPollingActive(false);
      fetchCrawlById(activeCrawlId)
        .then((fullData) => {
          setCrawlResult(fullData);
          if (fullData.pages && fullData.pages.length > 0) {
            const root = fullData.pages.find(
              (p) => p.normalized_url === fullData.normalized_starting_url || p.depth === 0
            );
            setSelectedPage(root || fullData.pages[0]);
          }
          loadHistory();
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load completed crawl details.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (statusData.status === 'FAILED') {
      setIsPollingActive(false);
      setError(statusData.error || 'Crawl task failed.');
      loadHistory();
      setLoading(false);
    }
  }, [statusData, activeCrawlId, loadHistory]);

  // Handle status polling error transitions to prevent stuck loading state
  useEffect(() => {
    if (statusError && isPollingActive) {
      setError(statusError);
      setIsPollingActive(false);
      setLoading(false);
    }
  }, [statusError, isPollingActive]);

  const handleStartCrawl = async (request: CrawlRequest) => {
    setLoading(true);
    setError(null);
    setSelectedPage(null);
    setDiagnostics(null);
    setClustersData(null);
    setIsHistoricalView(false);

    try {
      const result = await startCrawl(request);
      if (result.crawl_id) {
        setActiveCrawlId(result.crawl_id);
        setIsPollingActive(true);
        setCrawlResult(result);
      } else {
        throw new Error('Backend failed to return a valid crawl identifier.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while queuing the website crawl.');
      }
      setLoading(false);
    }
  };

  const handleViewHistoricalCrawl = async (crawlId: number) => {
    setLoading(true);
    setError(null);
    setSelectedPage(null);

    try {
      const result = await fetchCrawlById(crawlId);
      setCrawlResult(result);
      setIsHistoricalView(true);
      if (result.pages.length > 0) {
        const root = result.pages.find(
          (p) => p.normalized_url === result.normalized_starting_url || p.depth === 0
        );
        setSelectedPage(root || result.pages[0]);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`Failed to load historical crawl #${crawlId}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistoricalCrawl = async (crawlId: number) => {
    try {
      await deleteCrawlById(crawlId);
      if (crawlResult?.crawl_id === crawlId) {
        setCrawlResult(null);
        setSelectedPage(null);
        setDiagnostics(null);
        setClustersData(null);
        setIsHistoricalView(false);
      }
      loadHistory();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#EAF1F8] text-[#172033] flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Hero URL Input Form */}
        <UrlInput onStartCrawl={handleStartCrawl} isCrawling={loading} />

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl flex items-start gap-3 text-[#DC2626] text-sm shadow-sm animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#DC2626]">Crawl Error</span>
              <p className="mt-0.5 text-xs text-[#DC2626]">{error}</p>
            </div>
          </div>
        )}

        {/* Live Background Crawl Progress Card */}
        {(isPollingActive || statusData || (crawlResult && (crawlResult.status === 'QUEUED' || crawlResult.status === 'RUNNING'))) && (
          <CrawlProgressCard
            statusData={statusData}
            isPolling={isPolling}
            error={statusError}
          />
        )}

        {/* Results Source Indicator Header */}
        {crawlResult && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F5F8FC] p-3.5 rounded-xl border border-[#CBD8E6] shadow-sm">
            <div className="flex items-center gap-2">
              {isHistoricalView ? (
                <span className="px-3 py-1 bg-[#EEF2FF] text-[#6366F1] border border-[#C7D2FE] rounded-lg text-xs font-semibold flex items-center gap-1.5 font-mono">
                  <Database className="w-3.5 h-3.5" /> Saved Crawl Record #{crawlResult.crawl_id}
                </span>
              ) : (
                <span className="px-3 py-1 bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8] rounded-lg text-xs font-semibold flex items-center gap-1.5 font-mono">
                  <Zap className="w-3.5 h-3.5" /> Live Crawl Result #{crawlResult.crawl_id || 'New'}
                </span>
              )}
            </div>

            <div className="text-xs font-mono text-[#526174]">
              Target: <span className="font-semibold text-[#172033]">{crawlResult.starting_url}</span>
            </div>
          </div>
        )}

        {/* Crawl Statistics Summary */}
        <StatsOverview crawlResult={crawlResult} />

        {/* SEO Keyword & Topic Clusters Section */}
        {crawlResult && (
          <SEOClustersOverview
            clustersData={clustersData}
            pages={crawlResult.pages}
            onSelectPage={(page) => setSelectedPage(page)}
            loading={clustersLoading}
          />
        )}

        {/* Website Health & Diagnostics Section */}
        {crawlResult && (
          <DiagnosticsOverview
            diagnostics={diagnostics}
            loading={diagnosticsLoading}
          />
        )}

        {/* Interactive Site Map Section */}
        <SiteMap
          crawlResult={crawlResult}
          selectedPageUrl={selectedPage?.url}
          onSelectPage={(page) => setSelectedPage(page)}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          depthFilter={depthFilter}
        />

        {/* Selected Page Details Side/Bottom Panel */}
        {selectedPage && (
          <PageDetailsPanel
            page={selectedPage}
            allPages={crawlResult?.pages || []}
            onClose={() => setSelectedPage(null)}
            onSelectPage={(page) => setSelectedPage(page)}
          />
        )}

        {/* Crawled Pages Table */}
        {crawlResult && (
          <CrawlResultsTable
            pages={crawlResult.pages}
            startingUrl={crawlResult.starting_url}
            selectedPageUrl={selectedPage?.url}
            onSelectPage={(page) => setSelectedPage(page)}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            depthFilter={depthFilter}
            onDepthFilterChange={setDepthFilter}
          />
        )}

        {/* Export Controls Section */}
        <ExportCard
          crawlResult={crawlResult}
          diagnostics={diagnostics}
          filteredPages={filteredPages}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Crawl History Section */}
        <CrawlHistoryTable
          history={history}
          currentCrawlId={crawlResult?.crawl_id}
          onViewCrawl={handleViewHistoricalCrawl}
          onDeleteCrawl={handleDeleteHistoricalCrawl}
          loading={historyLoading}
        />

      </main>

      <footer className="border-t border-[#CBD8E6] bg-[#F5F8FC] py-6 text-center text-xs text-[#718096]">
        <div className="max-w-7xl mx-auto px-4">
          WebAtlas &bull; Intelligent Website Crawler & Site Mapper &bull; Internship Project
        </div>
      </footer>
    </div>
  );
};

