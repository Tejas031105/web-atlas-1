import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ExternalLink, CheckCircle, AlertCircle, ArrowUpRight, Home, FileText, XCircle, Zap, Filter } from 'lucide-react';
import { PageResponse } from '../types';

export type StatusFilterType = 'ALL' | 'SUCCESS' | 'REDIRECT' | 'CLIENT_ERROR' | 'SERVER_ERROR' | 'CRAWL_ERROR';

interface CrawlResultsTableProps {
  pages: PageResponse[];
  startingUrl: string;
  selectedPageUrl?: string | null;
  onSelectPage?: (page: PageResponse) => void;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  statusFilter?: StatusFilterType;
  onStatusFilterChange?: (status: StatusFilterType) => void;
  depthFilter?: string;
  onDepthFilterChange?: (depth: string) => void;
}

export const CrawlResultsTable: React.FC<CrawlResultsTableProps> = ({
  pages,
  startingUrl,
  selectedPageUrl,
  onSelectPage,
  searchTerm: propsSearchTerm,
  onSearchTermChange,
  statusFilter: propsStatusFilter,
  onStatusFilterChange,
  depthFilter: propsDepthFilter,
  onDepthFilterChange,
}) => {
  // Local fallback state if props are not provided
  const [localSearchTerm, setLocalSearchTerm] = useState<string>('');
  const [localStatusFilter, setLocalStatusFilter] = useState<StatusFilterType>('ALL');
  const [localDepthFilter, setLocalDepthFilter] = useState<string>('ALL');

  const searchTerm = propsSearchTerm !== undefined ? propsSearchTerm : localSearchTerm;
  const statusFilter = propsStatusFilter !== undefined ? propsStatusFilter : localStatusFilter;
  const depthFilter = propsDepthFilter !== undefined ? propsDepthFilter : localDepthFilter;

  const handleSearchChange = (val: string) => {
    if (onSearchTermChange) onSearchTermChange(val);
    else setLocalSearchTerm(val);
  };

  const handleStatusChange = (val: StatusFilterType) => {
    if (onStatusFilterChange) onStatusFilterChange(val);
    else setLocalStatusFilter(val);
  };

  const handleDepthChange = (val: string) => {
    if (onDepthFilterChange) onDepthFilterChange(val);
    else setLocalDepthFilter(val);
  };

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Auto-scroll selected page row into view when selectedPageUrl changes
  useEffect(() => {
    if (selectedPageUrl && rowRefs.current[selectedPageUrl]) {
      rowRefs.current[selectedPageUrl]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedPageUrl]);

  // Compute status counts for filter options
  const categoryCounts = useMemo(() => {
    let success = 0;
    let redirect = 0;
    let clientErr = 0;
    let serverErr = 0;
    let crawlErr = 0;

    pages.forEach((p) => {
      const code = p.status_code;
      if (!code || !p.crawl_success) {
        crawlErr++;
      } else if (code >= 200 && code < 300) {
        success++;
      } else if (code >= 300 && code < 400) {
        redirect++;
      } else if (code >= 400 && code < 500) {
        clientErr++;
      } else if (code >= 500 && code < 600) {
        serverErr++;
      }
    });

    return { success, redirect, clientErr, serverErr, crawlErr, total: pages.length };
  }, [pages]);

  // Extract unique depth values present in crawl results
  const availableDepths = useMemo(() => {
    const depths = new Set<number>();
    pages.forEach((p) => depths.add(p.depth ?? 0));
    return Array.from(depths).sort((a, b) => a - b);
  }, [pages]);

  // Combined filtering logic: Status + Depth + Search
  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      const code = p.status_code;
      
      // 1. Status Category Filter
      if (statusFilter === 'SUCCESS' && (code === null || code < 200 || code >= 300)) return false;
      if (statusFilter === 'REDIRECT' && (code === null || code < 300 || code >= 400)) return false;
      if (statusFilter === 'CLIENT_ERROR' && (code === null || code < 400 || code >= 500)) return false;
      if (statusFilter === 'SERVER_ERROR' && (code === null || code < 500 || code >= 600)) return false;
      if (statusFilter === 'CRAWL_ERROR' && (p.crawl_success && code && code < 400)) return false;

      // 2. Depth Level Filter
      if (depthFilter !== 'ALL') {
        const targetDepth = Number(depthFilter);
        if ((p.depth ?? 0) !== targetDepth) return false;
      }

      // 3. Text Search Filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.url.toLowerCase().includes(term) ||
        (p.title && p.title.toLowerCase().includes(term)) ||
        (p.status_code && p.status_code.toString().includes(term))
      );
    });
  }, [pages, statusFilter, depthFilter, searchTerm]);

  const getStatusBadge = (page: PageResponse) => {
    const code = page.status_code;
    if (!code || !page.crawl_success) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <Zap className="w-3 h-3 text-[#DC2626]" /> ERR
        </span>
      );
    }
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8]">
          <CheckCircle className="w-3 h-3" /> {code}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          <ArrowUpRight className="w-3 h-3" /> {code}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <AlertCircle className="w-3 h-3" /> {code}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#F3E8FF] text-[#7C3AED] border border-[#D8B4FE]">
        <XCircle className="w-3 h-3" /> {code}
      </span>
    );
  };

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl overflow-hidden shadow-sm space-y-0">
      
      {/* Header Toolbar: Title & Filter Controls (Search, Status Filter, Depth Filter) */}
      <div className="p-4 bg-[#DCE7F2] border-b border-[#CBD8E6] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div>
            <h3 className="text-base font-semibold text-[#172033]">Discovered Website Pages</h3>
            <p className="text-xs text-[#526174]">Showing {filteredPages.length} of {pages.length} total pages</p>
          </div>

          {/* Filter Controls Toolbar: Search + Status Dropdown + Depth Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* 1. Search Control */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[#526174]">Search:</label>
              <div className="relative min-w-[180px] sm:min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#718096] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#EDF3F9] border border-[#BFCFE0] rounded-xl text-xs text-[#172033] placeholder-[#718096] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-all"
                />
              </div>
            </div>

            {/* 2. Status Select Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[#526174]">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value as StatusFilterType)}
                className="bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All ({categoryCounts.total})</option>
                <option value="SUCCESS">✓ Successful ({categoryCounts.success})</option>
                <option value="REDIRECT">↪ Redirected ({categoryCounts.redirect})</option>
                <option value="CLIENT_ERROR">⚠ Client Errors ({categoryCounts.clientErr})</option>
                <option value="SERVER_ERROR">✕ Server Errors ({categoryCounts.serverErr})</option>
                <option value="CRAWL_ERROR">⚡ Crawl Errors ({categoryCounts.crawlErr})</option>
              </select>
            </div>

            {/* 3. Depth Select Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[#526174]">Depth:</label>
              <select
                value={depthFilter}
                onChange={(e) => handleDepthChange(e.target.value)}
                className="bg-[#EDF3F9] border border-[#BFCFE0] text-[#172033] rounded-xl px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All Depths</option>
                {availableDepths.map((d) => (
                  <option key={d} value={d.toString()}>
                    Depth d={d} ({pages.filter((p) => (p.depth ?? 0) === d).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters button if filters are active */}
            {(statusFilter !== 'ALL' || depthFilter !== 'ALL' || searchTerm.trim() !== '') && (
              <button
                onClick={() => {
                  handleStatusChange('ALL');
                  handleDepthChange('ALL');
                  handleSearchChange('');
                }}
                className="text-xs text-[#2563EB] hover:text-[#1D4ED8] underline font-medium px-1"
              >
                Reset
              </button>
            )}

          </div>

        </div>

        {/* Quick Status Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs border-t border-[#CBD8E6]/60">
          <span className="text-[11px] text-[#526174] font-sans font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#2563EB]" /> Quick Category:
          </span>

          <button
            onClick={() => handleStatusChange('ALL')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
              statusFilter === 'ALL'
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#EDF3F9] text-[#172033] hover:bg-[#E1EBF4] border border-[#CBD8E6]'
            }`}
          >
            All ({categoryCounts.total})
          </button>
          
          <button
            onClick={() => handleStatusChange('SUCCESS')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
              statusFilter === 'SUCCESS'
                ? 'bg-[#16A34A] text-white'
                : 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8] hover:opacity-90'
            }`}
          >
            ✓ Successful ({categoryCounts.success})
          </button>

          <button
            onClick={() => handleStatusChange('REDIRECT')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
              statusFilter === 'REDIRECT'
                ? 'bg-[#D97706] text-white'
                : 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A] hover:opacity-90'
            }`}
          >
            ↪ Redirected ({categoryCounts.redirect})
          </button>

          <button
            onClick={() => handleStatusChange('CLIENT_ERROR')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
              statusFilter === 'CLIENT_ERROR'
                ? 'bg-[#DC2626] text-white'
                : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5] hover:opacity-90'
            }`}
          >
            ⚠ Client Errors ({categoryCounts.clientErr})
          </button>

          <button
            onClick={() => handleStatusChange('SERVER_ERROR')}
            className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
              statusFilter === 'SERVER_ERROR'
                ? 'bg-[#7C3AED] text-white'
                : 'bg-[#F3E8FF] text-[#7C3AED] border border-[#D8B4FE] hover:opacity-90'
            }`}
          >
            ✕ Server Errors ({categoryCounts.serverErr})
          </button>

          {categoryCounts.crawlErr > 0 && (
            <button
              onClick={() => handleStatusChange('CRAWL_ERROR')}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-all shadow-sm ${
                statusFilter === 'CRAWL_ERROR'
                  ? 'bg-[#526174] text-white'
                  : 'bg-[#EDF3F9] text-[#526174] border border-[#CBD8E6] hover:opacity-90'
              }`}
            >
              ⚡ Crawl Errors ({categoryCounts.crawlErr})
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#172033]">
          <thead className="bg-[#DCE7F2] text-[#334155] uppercase font-mono text-[11px] border-b border-[#CBD8E6]">
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Page Title & URL</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Depth</th>
              <th className="py-3 px-4">Parent Link</th>
              <th className="py-3 px-4 text-center">Int. Links</th>
              <th className="py-3 px-4 text-center">Ext. Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CBD8E6]/60 font-sans">
            {filteredPages.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#718096] font-mono">
                  No discovered pages match your active status category, depth filter, or search term.
                </td>
              </tr>
            ) : (
              filteredPages.map((page, index) => {
                const isRoot = page.url === startingUrl || page.normalized_url === startingUrl || page.depth === 0;
                const isSelected = selectedPageUrl ? (page.url === selectedPageUrl || page.normalized_url === selectedPageUrl) : false;

                return (
                  <tr
                    key={index}
                    ref={(el) => {
                      rowRefs.current[page.url] = el;
                      if (page.normalized_url) rowRefs.current[page.normalized_url] = el;
                    }}
                    onClick={() => onSelectPage && onSelectPage(page)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#DBEAFE]/80 border-l-4 border-l-[#2563EB] shadow-xs'
                        : 'bg-[#F5F8FC] hover:bg-[#E8F0F7]'
                    }`}
                  >
                    
                    {/* Index */}
                    <td className="py-3 px-4 text-center font-mono text-[#718096] font-semibold">
                      {index + 1}
                    </td>

                    {/* Page Title & URL */}
                    <td className="py-3 px-4 max-w-sm">
                      <div className="flex items-center gap-2">
                        {isRoot ? (
                          <div className="p-1 bg-[#DBEAFE] text-[#2563EB] rounded shrink-0">
                            <Home className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 bg-[#EDF3F9] text-[#718096] rounded shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-semibold text-[#172033] block truncate" title={page.title || 'Untitled'}>
                            {page.title || <span className="text-[#718096] italic">(No Title)</span>}
                          </span>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-mono text-[#2563EB] hover:text-[#1D4ED8] hover:underline truncate block flex items-center gap-1"
                            title={page.url}
                          >
                            <span>{page.url}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Status Code */}
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(page)}
                    </td>

                    {/* Depth */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-[#172033]">
                      <span className="px-2 py-0.5 bg-[#EDF3F9] border border-[#CBD8E6] rounded text-[11px]">
                        d={page.depth}
                      </span>
                    </td>

                    {/* Parent Page URL */}
                    <td className="py-3 px-4 max-w-xs font-mono text-[11px]">
                      {page.parent_url ? (
                        <span className="text-[#526174] truncate block" title={page.parent_url}>
                          {page.parent_url}
                        </span>
                      ) : (
                        <span className="text-[#2563EB] font-sans font-semibold text-xs">Starting Root</span>
                      )}
                    </td>

                    {/* Internal Links Count */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-[#6366F1]">
                      {page.internal_links.length}
                    </td>

                    {/* External Links Count */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-[#0891B2]">
                      {page.external_links.length}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

