import React from 'react';
import { CrawlStatusResponse } from '../types';
import { Loader2, Clock, CheckCircle2, AlertCircle, Cpu, Layers, FileText, AlertTriangle } from 'lucide-react';

interface CrawlProgressCardProps {
  statusData: CrawlStatusResponse | null;
  isPolling: boolean;
  error?: string | null;
}

export const CrawlProgressCard: React.FC<CrawlProgressCardProps> = ({ statusData, isPolling, error }) => {
  if (!statusData && !error) return null;

  if (error) {
    return (
      <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-2xl p-5 shadow-sm text-[#DC2626] animate-fadeIn">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
          <div>
            <h4 className="font-bold text-sm">Crawl Status Error</h4>
            <p className="text-xs text-[#DC2626] mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!statusData) return null;

  const isQueued = statusData.status === 'QUEUED';
  const isRunning = statusData.status === 'RUNNING';
  const isCompleted = statusData.status === 'COMPLETED';
  const isFailed = statusData.status === 'FAILED';

  const progressPercent = statusData.progress_percent !== null && statusData.progress_percent !== undefined
    ? Math.min(Math.max(statusData.progress_percent, 0), 100)
    : null;

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-6 shadow-sm space-y-5 animate-fadeIn">
      
      {/* Header & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#CBD8E6]/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#2563EB]" />
            <h3 className="text-base font-bold text-[#172033]">Background Crawl Status</h3>
            {statusData.crawl_id && (
              <span className="font-mono text-xs text-[#718096] bg-[#EDF3F9] px-2 py-0.5 rounded border border-[#CBD8E6]">
                #{statusData.crawl_id}
              </span>
            )}
          </div>
          <p className="text-xs text-[#526174] font-mono">
            Target: <span className="font-semibold text-[#172033]">{statusData.starting_url}</span> ({statusData.domain})
          </p>
        </div>

        {/* Dynamic Status Badge & Polling Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          {isPolling && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#2563EB] font-mono font-medium bg-[#EDF3F9] px-2 py-1 rounded border border-[#CBD8E6]">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-ping" />
              Live Updates
            </span>
          )}

          {isQueued && (
            <span className="px-3 py-1.5 bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs font-mono">
              <Clock className="w-3.5 h-3.5 animate-pulse text-[#D97706]" /> QUEUED
            </span>
          )}

          {isRunning && (
            <span className="px-3 py-1.5 bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" /> RUNNING
            </span>
          )}

          {isCompleted && (
            <span className="px-3 py-1.5 bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> COMPLETED
            </span>
          )}

          {isFailed && (
            <span className="px-3 py-1.5 bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" /> FAILED
            </span>
          )}
        </div>
      </div>

      {/* User Guidance Status Message */}
      <div className="text-xs text-[#526174] font-medium bg-[#EDF3F9] p-3 rounded-xl border border-[#CBD8E6]">
        {isQueued && (
          <p className="flex items-center gap-2 text-[#D97706]">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Your crawl has been queued and will start when a worker is available.</span>
          </p>
        )}
        {isRunning && (
          <p className="flex items-center gap-2 text-[#2563EB]">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            <span>Celery worker active: Crawling internal pages and discovering links...</span>
          </p>
        )}
        {isCompleted && (
          <p className="flex items-center gap-2 text-[#16A34A]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Crawl completed successfully! Processing site map and health diagnostics...</span>
          </p>
        )}
        {isFailed && (
          <p className="flex items-center gap-2 text-[#DC2626]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Crawl task failed: {statusData.error || 'Unexpected execution error occurred.'}</span>
          </p>
        )}
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
        
        <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-1">
          <div className="text-[#718096] flex items-center gap-1 font-semibold text-[11px]">
            <FileText className="w-3.5 h-3.5 text-[#2563EB]" /> Pages Crawled
          </div>
          <div className="text-lg font-bold font-mono text-[#172033]">
            {statusData.pages_crawled} <span className="text-xs text-[#718096] font-normal">/ {statusData.max_pages}</span>
          </div>
        </div>

        <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-1">
          <div className="text-[#718096] flex items-center gap-1 font-semibold text-[11px]">
            <FileText className="w-3.5 h-3.5 text-[#6366F1]" /> Discovered
          </div>
          <div className="text-lg font-bold font-mono text-[#172033]">
            {statusData.pages_discovered}
          </div>
        </div>

        <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-1">
          <div className="text-[#718096] flex items-center gap-1 font-semibold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" /> Failed Pages
          </div>
          <div className={`text-lg font-bold font-mono ${statusData.pages_failed > 0 ? 'text-[#DC2626]' : 'text-[#172033]'}`}>
            {statusData.pages_failed}
          </div>
        </div>

        <div className="p-3 bg-[#F5F8FC] border border-[#CBD8E6] rounded-xl space-y-1">
          <div className="text-[#718096] flex items-center gap-1 font-semibold text-[11px]">
            <Layers className="w-3.5 h-3.5 text-[#D97706]" /> Current Depth
          </div>
          <div className="text-lg font-bold font-mono text-[#172033]">
            {statusData.current_depth} <span className="text-xs text-[#718096] font-normal">/ max {statusData.max_depth}</span>
          </div>
        </div>

      </div>

      {/* Progress Bar Display */}
      {progressPercent !== null ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-semibold text-[#526174]">
            <span>Crawl Progress</span>
            <span className="font-mono text-[#2563EB]">{progressPercent.toFixed(1)}%</span>
          </div>
          <div
            className="w-full bg-[#E1EBF4] rounded-full h-2.5 overflow-hidden border border-[#CBD8E6]"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Crawl Progress Percentage"
          >
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isCompleted
                  ? 'bg-[#16A34A]'
                  : isFailed
                  ? 'bg-[#DC2626]'
                  : 'bg-[#2563EB] bg-gradient-to-r from-[#2563EB] to-[#3B82F6]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-xs font-mono text-[#718096] text-center pt-1">
          {statusData.pages_crawled} pages crawled &middot; {statusData.pages_discovered} discovered
        </div>
      )}

    </div>
  );
};
