import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Globe,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  Layers,
  Home,
  Link2,
  Zap,
  CornerDownRight,
  ArrowUpRight,
  ShieldAlert,
  Info,
  Calendar,
  XCircle,
} from 'lucide-react';
import { PageResponse } from '../types';

interface PageDetailsPanelProps {
  page: PageResponse | null;
  allPages?: PageResponse[];
  onClose: () => void;
  onSelectPage?: (page: PageResponse) => void;
}

type TabType = 'overview' | 'links' | 'technical';

export const PageDetailsPanel: React.FC<PageDetailsPanelProps> = ({
  page,
  allPages = [],
  onClose,
  onSelectPage,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copied, setCopied] = useState<boolean>(false);

  if (!page) return null;

  // Handle URL Copy
  const handleCopyUrl = (urlToCopy: string) => {
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Handle Open Page
  const handleOpenPage = (targetUrl: string) => {
    if (!targetUrl) return;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // Parent Page Lookup
  const parentPage = page.parent_url
    ? allPages.find(
        (p) => p.url === page.parent_url || p.normalized_url === page.parent_url
      )
    : null;

  // Child Pages Lookup
  const childPages = allPages.filter(
    (p) =>
      p.parent_url === page.url ||
      (p.parent_url && p.parent_url === page.normalized_url)
  );

  // Link Analysis & Broken Link Detection
  const pageMapByUrl = new Map<string, PageResponse>();
  allPages.forEach((p) => {
    pageMapByUrl.set(p.url, p);
    if (p.normalized_url) pageMapByUrl.set(p.normalized_url, p);
  });

  const internalLinksAnalysis = (page.internal_links || []).map((linkUrl) => {
    const target = pageMapByUrl.get(linkUrl);
    return {
      url: linkUrl,
      targetPage: target || null,
      isCrawled: !!target,
      isBroken: target ? !target.crawl_success || (target.status_code !== null && target.status_code >= 400) : false,
      statusCode: target?.status_code ?? null,
    };
  });

  const brokenLinks = internalLinksAnalysis.filter((item) => item.isBroken);

  // Status Badge Classifier
  const getStatusBadge = (code: number | null, success: boolean) => {
    if (!code || !success) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <Zap className="w-3.5 h-3.5" /> Crawl Error
        </span>
      );
    }
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBE5C8]">
          <CheckCircle className="w-3.5 h-3.5" /> {code} OK
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          <ArrowUpRight className="w-3.5 h-3.5" /> {code} Redirect
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
          <AlertCircle className="w-3.5 h-3.5" /> {code} Client Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#F3E8FF] text-[#7C3AED] border border-[#D8B4FE]">
        <XCircle className="w-3.5 h-3.5" /> {code} Server Error
      </span>
    );
  };

  // Format Response Time
  const formatTime = (sec: number) => {
    if (!sec || sec <= 0) return 'Not available';
    if (sec < 1) return `${Math.round(sec * 1000)} ms`;
    return `${sec.toFixed(2)} s`;
  };

  // Format Timestamp
  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Not available';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const isRoot = page.depth === 0 || !page.parent_url;

  return (
    <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl shadow-lg overflow-hidden animate-fadeIn space-y-0">
      
      {/* Panel Top Header Bar */}
      <div className="p-4 bg-[#DCE7F2] border-b border-[#CBD8E6] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#DBEAFE] text-[#2563EB] rounded-xl shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#172033] leading-tight">
                {page.title || <span className="italic font-normal text-[#718096]">(No Title)</span>}
              </h3>
              {isRoot && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0] rounded">
                  Root Page
                </span>
              )}
            </div>
            <p className="text-xs text-[#526174] font-mono truncate max-w-xl mt-0.5" title={page.url}>
              {page.url}
            </p>
          </div>
        </div>

        {/* Action Header Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopyUrl(page.url)}
            className="px-3 py-1.5 bg-[#EDF3F9] hover:bg-[#E1EBF4] text-[#172033] border border-[#CBD8E6] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            aria-label="Copy Page URL"
            title="Copy complete URL"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[#16A34A] font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Copy URL</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleOpenPage(page.url)}
            className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            aria-label="Open Page in New Tab"
            title="Open page in a new browser tab"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Open Page</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-[#718096] hover:text-[#172033] hover:bg-[#EDF3F9] rounded-xl transition-all ml-1"
            title="Close page details panel"
            aria-label="Close page details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 px-4 bg-[#DCE7F2]/50 border-b border-[#CBD8E6]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-[#2563EB] text-[#2563EB] bg-[#F5F8FC]'
              : 'border-transparent text-[#526174] hover:text-[#172033]'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'links'
              ? 'border-[#2563EB] text-[#2563EB] bg-[#F5F8FC]'
              : 'border-transparent text-[#526174] hover:text-[#172033]'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Links Analysis ({page.internal_links.length + page.external_links.length})</span>
          {brokenLinks.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FEE2E2] text-[#DC2626] font-bold">
              {brokenLinks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('technical')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'technical'
              ? 'border-[#2563EB] text-[#2563EB] bg-[#F5F8FC]'
              : 'border-transparent text-[#526174] hover:text-[#172033]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Technical Info</span>
        </button>
      </div>

      {/* Main Tab Contents */}
      <div className="p-5">
        
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] text-[11px] block font-medium">HTTP Status</span>
                <div className="mt-1">{getStatusBadge(page.status_code, page.crawl_success)}</div>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] text-[11px] block font-medium">Crawl Depth</span>
                <div className="flex items-center gap-1.5 mt-1.5 font-mono font-bold text-[#172033]">
                  <Layers className="w-4 h-4 text-[#7C3AED]" />
                  <span>Depth {page.depth}</span>
                </div>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] text-[11px] block font-medium">Response Time</span>
                <div className="flex items-center gap-1.5 mt-1.5 font-mono font-bold text-[#172033]">
                  <Clock className="w-4 h-4 text-[#D97706]" />
                  <span>{formatTime(page.response_time)}</span>
                </div>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] text-[11px] block font-medium">Content Type</span>
                <p className="font-mono text-[#172033] font-semibold truncate mt-1.5 text-[11px]" title={page.content_type || 'text/html'}>
                  {page.content_type || 'text/html'}
                </p>
              </div>
            </div>

            {/* SEO Keyword & Topic Cluster Section */}
            <div className="p-4 bg-[#EDF3F9]/80 border border-[#CBD8E6] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#172033]">
                  <Zap className="w-4 h-4 text-[#2563EB]" />
                  <span>SEO Keyword Mapping & Topic Cluster</span>
                </div>
                {page.cluster_id && (
                  <span className="px-2.5 py-0.5 bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0] rounded-full text-[11px] font-semibold font-mono">
                    {page.cluster_id}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F5F8FC] p-3 rounded-lg border border-[#CBD8E6] space-y-1">
                  <span className="text-[#526174] text-[11px] font-medium block">Primary Keyword</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#172033] text-sm">
                      {page.primary_keyword || 'N/A'}
                    </span>
                    {page.keyword_score && (
                      <span className="text-[10px] font-mono bg-[#DCFCE7] text-[#16A34A] px-1.5 py-0.5 rounded font-bold">
                        Score {page.keyword_score}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-[#F5F8FC] p-3 rounded-lg border border-[#CBD8E6] space-y-1">
                  <span className="text-[#526174] text-[11px] font-medium block">Topic Category & Cluster</span>
                  <div className="text-xs">
                    <span className="font-semibold text-[#172033] block">
                      Topic: <span className="font-normal text-[#526174]">{page.topic || 'General'}</span>
                    </span>
                    <span className="font-semibold text-[#172033] block mt-0.5">
                      Cluster: <span className="font-normal text-[#2563EB]">{page.cluster_name || page.cluster_id || 'General'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {page.related_keywords && page.related_keywords.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-[#526174] block">Related Keywords:</span>
                  <div className="flex flex-wrap gap-1">
                    {page.related_keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-[#F5F8FC] text-[#334155] border border-[#CBD8E6] rounded text-[11px] font-sans"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Parent & Children Hierarchy Navigation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Parent Page Card */}
              <div className="p-4 bg-[#EDF3F9]/60 border border-[#CBD8E6] rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#172033]">
                  <Home className="w-4 h-4 text-[#2563EB]" />
                  <span>Parent Page</span>
                </div>

                {isRoot ? (
                  <div className="p-2.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg text-xs font-semibold text-[#2563EB] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                    <span>Root Target (Starting Crawl Page)</span>
                  </div>
                ) : page.parent_url ? (
                  <div className="p-2.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#172033] truncate">
                        {parentPage?.title || 'Parent Page'}
                      </span>
                      {parentPage && onSelectPage && (
                        <button
                          onClick={() => onSelectPage(parentPage)}
                          className="text-[11px] font-semibold text-[#2563EB] hover:underline shrink-0"
                        >
                          Inspect &rarr;
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-[#526174] truncate" title={page.parent_url}>
                      {page.parent_url}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#718096] italic">Root Target</p>
                )}
              </div>

              {/* Child Pages Card */}
              <div className="p-4 bg-[#EDF3F9]/60 border border-[#CBD8E6] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#172033]">
                  <div className="flex items-center gap-2">
                    <CornerDownRight className="w-4 h-4 text-[#7C3AED]" />
                    <span>Child Pages Discovered ({childPages.length})</span>
                  </div>
                </div>

                {childPages.length === 0 ? (
                  <p className="text-xs text-[#718096] italic p-2 bg-[#F5F8FC] rounded-lg border border-[#CBD8E6]">
                    No child pages discovered.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {childPages.map((child, idx) => (
                      <div
                        key={idx}
                        onClick={() => onSelectPage && onSelectPage(child)}
                        className="p-2 bg-[#F5F8FC] hover:bg-[#DBEAFE]/60 border border-[#CBD8E6] rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      >
                        <div className="truncate">
                          <span className="font-semibold text-[#172033] block truncate" title={child.title || child.url}>
                            {child.title || child.url}
                          </span>
                          <span className="font-mono text-[10px] text-[#526174] truncate block">
                            {child.url}
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#2563EB] shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ================= TAB 2: LINKS ANALYSIS ================= */}
        {activeTab === 'links' && (
          <div className="space-y-6">
            
            {/* Link Summary Cards */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-center">
                <span className="text-[#4338CA] text-[11px] font-semibold block">Internal Links</span>
                <span className="text-lg font-bold font-mono text-[#3730A3] mt-0.5 block">
                  {page.internal_links.length}
                </span>
              </div>

              <div className="p-3 bg-[#ECFEFF] border border-[#A5F3FC] rounded-xl text-center">
                <span className="text-[#0891B2] text-[11px] font-semibold block">External Links</span>
                <span className="text-lg font-bold font-mono text-[#0E7490] mt-0.5 block">
                  {page.external_links.length}
                </span>
              </div>

              <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-center">
                <span className="text-[#DC2626] text-[11px] font-semibold block">Broken Links</span>
                <span className="text-lg font-bold font-mono text-[#991B1B] mt-0.5 block">
                  {brokenLinks.length}
                </span>
              </div>
            </div>

            {/* Broken Links Warning Box */}
            {brokenLinks.length > 0 && (
              <div className="p-3.5 bg-[#FEE2E2]/80 border border-[#FCA5A5] rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#DC2626]">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Detected Broken Links on Page ({brokenLinks.length})</span>
                </div>
                <div className="space-y-1.5 font-mono text-xs">
                  {brokenLinks.map((item, idx) => (
                    <div key={idx} className="p-2 bg-white rounded border border-[#FCA5A5] flex items-center justify-between gap-2">
                      <span className="text-[#DC2626] font-bold text-[11px] px-1.5 py-0.5 bg-[#FEE2E2] rounded">
                        {item.statusCode || 'ERR'}
                      </span>
                      <span className="text-[#172033] truncate flex-1" title={item.url}>{item.url}</span>
                      {item.targetPage && onSelectPage && (
                        <button
                          onClick={() => onSelectPage(item.targetPage!)}
                          className="text-[11px] text-[#2563EB] underline font-sans font-semibold shrink-0"
                        >
                          Inspect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Links List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#6366F1]" />
                <span>Internal Links ({page.internal_links.length})</span>
              </h4>

              {page.internal_links.length === 0 ? (
                <p className="text-xs text-[#718096] italic p-3 bg-[#EDF3F9] rounded-xl border border-[#CBD8E6]">
                  No internal links found.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 bg-[#EDF3F9]/60 p-2 border border-[#CBD8E6] rounded-xl font-mono text-xs">
                  {internalLinksAnalysis.map((item, idx) => (
                    <div key={idx} className="p-2 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg flex items-center justify-between gap-2">
                      <span className="text-[#2563EB] truncate flex-1" title={item.url}>{item.url}</span>
                      {item.isCrawled ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.isBroken ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'
                          }`}>
                            {item.statusCode || '200'}
                          </span>
                          {onSelectPage && item.targetPage && (
                            <button
                              onClick={() => onSelectPage(item.targetPage!)}
                              className="text-[11px] text-[#2563EB] underline font-sans font-semibold"
                            >
                              Inspect
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-[#E2E8F0] text-[#64748B]">
                          Not crawled
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* External Links List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-[#0891B2]" />
                <span>External Links ({page.external_links.length})</span>
              </h4>

              {page.external_links.length === 0 ? (
                <p className="text-xs text-[#718096] italic p-3 bg-[#EDF3F9] rounded-xl border border-[#CBD8E6]">
                  No external links found.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1 bg-[#EDF3F9]/60 p-2 border border-[#CBD8E6] rounded-xl font-mono text-xs">
                  {page.external_links.map((link, idx) => (
                    <div key={idx} className="p-2 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg flex items-center justify-between gap-2">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0891B2] hover:underline truncate flex-1 flex items-center gap-1"
                        title={link}
                      >
                        <span>{link}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <span className="px-2 py-0.5 text-[10px] font-sans font-semibold bg-[#E0F2FE] text-[#0369A1] rounded shrink-0">
                        External Domain
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= TAB 3: TECHNICAL INFO ================= */}
        {activeTab === 'technical' && (
          <div className="space-y-4 text-xs font-sans">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              
              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] font-sans text-[11px] block">HTTP Status Code:</span>
                <span className="text-sm font-bold text-[#172033] mt-1 block">
                  {page.status_code ? `${page.status_code}` : 'No Status Code'}
                </span>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] font-sans text-[11px] block">Response Time:</span>
                <span className="text-sm font-bold text-[#172033] mt-1 block">
                  {formatTime(page.response_time)}
                </span>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] font-sans text-[11px] block">Content Type:</span>
                <span className="text-xs font-bold text-[#172033] mt-1 block truncate" title={page.content_type || 'text/html'}>
                  {page.content_type || 'text/html'}
                </span>
              </div>

              <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
                <span className="text-[#526174] font-sans text-[11px] block flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#2563EB]" /> Discovered At:
                </span>
                <span className="text-xs font-semibold text-[#172033] mt-1 block truncate">
                  {formatTimestamp(page.discovered_at)}
                </span>
              </div>

            </div>

            {/* Redirect Details */}
            <div className="p-3.5 bg-[#EDF3F9]/60 border border-[#CBD8E6] rounded-xl space-y-1">
              <span className="font-bold text-[#172033] block">Redirect Status:</span>
              {page.status_code && page.status_code >= 300 && page.status_code < 400 ? (
                <div className="space-y-1 text-xs font-mono text-[#D97706]">
                  <p>Status: {page.status_code} Redirect</p>
                  <p className="truncate">Original URL: {page.url}</p>
                </div>
              ) : (
                <p className="text-xs text-[#526174] italic">No redirect.</p>
              )}
            </div>

            {/* Error Log Section */}
            {page.error_message ? (
              <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-[#DC2626] space-y-1">
                <span className="font-bold block">Crawl Error Log:</span>
                <p className="font-mono text-xs break-all">{page.error_message}</p>
              </div>
            ) : (
              <div className="p-3.5 bg-[#DCFCE7]/60 border border-[#BBE5C8] rounded-xl text-[#16A34A] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                <span className="font-semibold text-xs">No errors logged during page crawl.</span>
              </div>
            )}

            {/* Normalized URL */}
            <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl font-mono text-xs">
              <span className="text-[#526174] font-sans text-[11px] block">Normalized System URL:</span>
              <span className="text-[#172033] break-all block mt-0.5">{page.normalized_url}</span>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};

