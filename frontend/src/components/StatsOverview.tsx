import React, { useMemo } from 'react';
import {
  FileText,
  Link,
  ExternalLink,
  Layers,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Gauge,
} from 'lucide-react';
import { CrawlResponse } from '../types';

interface StatsOverviewProps {
  crawlResult: CrawlResponse | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ crawlResult }) => {
  const totalPages = crawlResult ? crawlResult.total_pages : 0;
  const internalLinks = crawlResult ? crawlResult.total_internal_links : 0;
  const externalLinks = crawlResult ? crawlResult.total_external_links : 0;
  const crawlDepth = crawlResult ? crawlResult.max_depth_reached : 0;
  const failedPages = crawlResult ? crawlResult.failed_pages : 0;
  const duration = crawlResult ? crawlResult.duration_seconds : 0.0;

  // Compute status counts and averages from real crawl data
  const { successCount, redirectCount, clientErrCount, serverErrCount, networkErrCount, brokenCount, avgResponseTime } = useMemo(() => {
    if (!crawlResult || !crawlResult.pages || crawlResult.pages.length === 0) {
      return {
        successCount: 0,
        redirectCount: 0,
        clientErrCount: 0,
        serverErrCount: 0,
        networkErrCount: 0,
        brokenCount: 0,
        avgResponseTime: 0.0,
      };
    }

    let success = 0;
    let redirect = 0;
    let clientErr = 0;
    let serverErr = 0;
    let networkErr = 0;
    let broken = 0;
    let totalRespTime = 0;

    crawlResult.pages.forEach((p) => {
      totalRespTime += p.response_time || 0;
      const code = p.status_code;
      if (!code || !p.crawl_success) {
        networkErr++;
        broken++;
      } else if (code >= 200 && code < 300) {
        success++;
      } else if (code >= 300 && code < 400) {
        redirect++;
      } else if (code >= 400 && code < 500) {
        clientErr++;
        broken++;
      } else if (code >= 500 && code < 600) {
        serverErr++;
        broken++;
      }
    });

    const avgTime = Number((totalRespTime / crawlResult.pages.length).toFixed(3));

    return {
      successCount: success,
      redirectCount: redirect,
      clientErrCount: clientErr,
      serverErrCount: serverErr,
      networkErrCount: networkErr,
      brokenCount: broken,
      avgResponseTime: avgTime,
    };
  }, [crawlResult]);

  return (
    <div className="space-y-4">
      
      {/* 10 Advanced Crawl Analysis Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Total Pages */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Total Pages</span>
            <div className="p-2 bg-[#DBEAFE] text-[#2563EB] rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#2563EB]">{totalPages}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">Target pages fetched</p>
          </div>
        </div>

        {/* 2. Successful Pages */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Successful Pages</span>
            <div className="p-2 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#16A34A]">{successCount}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">HTTP 2xx responses</p>
          </div>
        </div>

        {/* 3. Failed Pages */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Failed Pages</span>
            <div className={`p-2 rounded-lg ${failedPages > 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl font-bold font-mono ${failedPages > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
              {failedPages}
            </div>
            <p className="text-[11px] text-[#718096] mt-0.5">
              {failedPages === 0 ? '0 fetch failures' : 'Crawl/HTTP failures'}
            </p>
          </div>
        </div>

        {/* 4. Internal Links */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Internal Links</span>
            <div className="p-2 bg-[#EEF2FF] text-[#6366F1] rounded-lg">
              <Link className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#6366F1]">{internalLinks}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">Same-domain links</p>
          </div>
        </div>

        {/* 5. External Links */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">External Links</span>
            <div className="p-2 bg-[#E0F2FE] text-[#0891B2] rounded-lg">
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#0891B2]">{externalLinks}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">External domain links</p>
          </div>
        </div>

        {/* 6. Broken Pages */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Broken Pages</span>
            <div className={`p-2 rounded-lg ${brokenCount > 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'}`}>
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-2xl font-bold font-mono ${brokenCount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
              {brokenCount}
            </div>
            <p className="text-[11px] text-[#718096] mt-0.5">4xx, 5xx & network errors</p>
          </div>
        </div>

        {/* 7. Redirected Pages */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Redirected Pages</span>
            <div className="p-2 bg-[#FEF3C7] text-[#D97706] rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#D97706]">{redirectCount}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">HTTP 3xx redirects</p>
          </div>
        </div>

        {/* 8. Maximum Depth */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Maximum Depth</span>
            <div className="p-2 bg-[#F3E8FF] text-[#7C3AED] rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#7C3AED]">d={crawlDepth}</div>
            <p className="text-[11px] text-[#718096] mt-0.5">Max depth discovered</p>
          </div>
        </div>

        {/* 9. Average Response Time */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Avg Response Time</span>
            <div className="p-2 bg-[#CCFBF1] text-[#0F766E] rounded-lg">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#0F766E]">{avgResponseTime}s</div>
            <p className="text-[11px] text-[#718096] mt-0.5">Mean latency per page</p>
          </div>
        </div>

        {/* 10. Total Crawl Duration */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526174]">Total Crawl Duration</span>
            <div className="p-2 bg-[#EDF3F9] text-[#172033] rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#172033]">{duration}s</div>
            <p className="text-[11px] text-[#718096] mt-0.5">Total execution time</p>
          </div>
        </div>

      </div>

      {/* Page Status Classification Summary Bar */}
      {crawlResult && crawlResult.pages && crawlResult.pages.length > 0 && (
        <div className="p-3.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#172033] uppercase tracking-wider font-mono text-[11px]">
            Page Status Classification Summary:
          </span>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="px-2.5 py-1 bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8] rounded-md font-semibold">
              ✓ Successful: <strong>{successCount}</strong>
            </span>
            <span className="px-2.5 py-1 bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] rounded-md font-semibold">
              ↪ Redirected: <strong>{redirectCount}</strong>
            </span>
            <span className="px-2.5 py-1 bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] rounded-md font-semibold">
              ⚠ Client Errors: <strong>{clientErrCount}</strong>
            </span>
            <span className="px-2.5 py-1 bg-[#F3E8FF] text-[#7C3AED] border border-[#D8B4FE] rounded-md font-semibold">
              ✕ Server Errors: <strong>{serverErrCount}</strong>
            </span>
            <span className="px-2.5 py-1 bg-[#EDF3F9] text-[#526174] border border-[#CBD8E6] rounded-md font-semibold">
              ⚡ Network/Crawl Errors: <strong>{networkErrCount}</strong>
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
