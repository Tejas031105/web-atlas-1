import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, FileCode, FileText, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { CrawlResponse, PageResponse, DiagnosticsResponse } from '../types';
import {
  exportToCSV,
  exportToJSON,
  exportToSitemapXml,
  exportToHTMLReport,
} from '../services/exportService';

interface ExportCardProps {
  crawlResult: CrawlResponse | null;
  diagnostics?: DiagnosticsResponse | null;
  filteredPages?: PageResponse[];
  hasActiveFilters?: boolean;
}

export const ExportCard: React.FC<ExportCardProps> = ({
  crawlResult,
  diagnostics,
  filteredPages = [],
  hasActiveFilters = false,
}) => {
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const hasData = crawlResult && crawlResult.pages && crawlResult.pages.length > 0;
  const targetPages = exportScope === 'filtered' && hasActiveFilters && filteredPages.length > 0
    ? filteredPages
    : crawlResult?.pages || [];

  const handleTriggerExport = (type: 'csv' | 'json' | 'sitemap' | 'report') => {
    if (!crawlResult || !hasData) return;

    try {
      setStatusMessage({ text: 'Preparing export download...', type: 'info' });

      setTimeout(() => {
        if (type === 'csv') {
          exportToCSV(crawlResult, targetPages);
        } else if (type === 'json') {
          exportToJSON(crawlResult, targetPages);
        } else if (type === 'sitemap') {
          exportToSitemapXml(crawlResult, targetPages);
        } else if (type === 'report') {
          exportToHTMLReport(crawlResult, diagnostics, targetPages);
        }

        setStatusMessage({ text: 'Export downloaded successfully!', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      }, 200);
    } catch (err) {
      console.error('Export error:', err);
      setStatusMessage({ text: 'Unable to generate export file.', type: 'error' });
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  if (!hasData) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-5 shadow-sm opacity-85 space-y-2 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 justify-center sm:justify-start">
          <div className="p-2.5 bg-[#EDF3F9] text-[#718096] rounded-xl border border-[#CBD8E6]">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#172033]">Export Crawl Data & Site Reports</h4>
            <p className="text-xs text-[#526174]">No crawl data available. Run a crawl to generate export files.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center pt-2 sm:pt-0">
          <button disabled className="px-3 py-1.5 bg-[#EDF3F9] text-[#718096] border border-[#CBD8E6] rounded-xl text-xs font-medium cursor-not-allowed opacity-60">
            CSV
          </button>
          <button disabled className="px-3 py-1.5 bg-[#EDF3F9] text-[#718096] border border-[#CBD8E6] rounded-xl text-xs font-medium cursor-not-allowed opacity-60">
            JSON
          </button>
          <button disabled className="px-3 py-1.5 bg-[#EDF3F9] text-[#718096] border border-[#CBD8E6] rounded-xl text-xs font-medium cursor-not-allowed opacity-60">
            Sitemap.xml
          </button>
          <button disabled className="px-3 py-1.5 bg-[#EDF3F9] text-[#718096] border border-[#CBD8E6] rounded-xl text-xs font-medium cursor-not-allowed opacity-60">
            Crawl Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-5 shadow-sm space-y-4">
      
      {/* Export Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#CBD8E6] pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#DBEAFE] text-[#2563EB] rounded-xl border border-[#BFCFE0]">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#172033]">Export Crawl Data & Site Reports</h4>
            <p className="text-xs text-[#526174]">
              Download structured data for {crawlResult.domain} ({targetPages.length} pages ready)
            </p>
          </div>
        </div>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-fadeIn ${
              statusMessage.type === 'success'
                ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8]'
                : statusMessage.type === 'error'
                ? 'bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]'
                : 'bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0]'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5 animate-bounce" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Mode Scope Selector & Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Scope Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#526174] font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#2563EB]" /> Export Scope:
          </span>

          <div className="inline-flex bg-[#EDF3F9] p-1 rounded-xl border border-[#CBD8E6] font-sans">
            <button
              onClick={() => setExportScope('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                exportScope === 'all'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#526174] hover:text-[#172033]'
              }`}
            >
              All Pages ({crawlResult.pages.length})
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => setExportScope('filtered')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  exportScope === 'filtered'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#526174] hover:text-[#172033]'
                }`}
              >
                Filtered ({filteredPages.length})
              </button>
            )}
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* CSV */}
          <button
            onClick={() => handleTriggerExport('csv')}
            className="px-3.5 py-2 bg-[#EDF3F9] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            title="Download CSV spreadsheet of discovered pages"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
            <span>CSV Export</span>
          </button>

          {/* JSON */}
          <button
            onClick={() => handleTriggerExport('json')}
            className="px-3.5 py-2 bg-[#EDF3F9] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            title="Download complete JSON crawl dataset"
          >
            <FileJson className="w-4 h-4 text-[#D97706]" />
            <span>JSON Export</span>
          </button>

          {/* Sitemap.xml */}
          <button
            onClick={() => handleTriggerExport('sitemap')}
            className="px-3.5 py-2 bg-[#EDF3F9] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            title="Generate standard sitemap.xml for SEO"
          >
            <FileCode className="w-4 h-4 text-[#6366F1]" />
            <span>Sitemap.xml</span>
          </button>

          {/* HTML Crawl Report */}
          <button
            onClick={() => handleTriggerExport('report')}
            className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Generate printable HTML Crawl Report & PDF summary"
          >
            <FileText className="w-4 h-4" />
            <span>Crawl Report</span>
          </button>

        </div>

      </div>

    </div>
  );
};
