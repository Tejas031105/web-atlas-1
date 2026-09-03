import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  FileCheck,
  FileWarning,
  Link,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { DiagnosticsResponse } from '../types';

interface DiagnosticsOverviewProps {
  diagnostics: DiagnosticsResponse | null;
  loading: boolean;
}

export const DiagnosticsOverview: React.FC<DiagnosticsOverviewProps> = ({
  diagnostics,
  loading,
}) => {
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [expandedIssueIdx, setExpandedIssueIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-8 text-center space-y-3 shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-[#DBEAFE] text-[#2563EB] animate-spin">
          <Activity className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-[#172033]">Analyzing Website Health & Diagnostics</h4>
        <p className="text-xs text-[#526174] max-w-sm mx-auto">
          Computing HTTP status distributions, broken links, depth hierarchy, and SEO title issues...
        </p>
      </div>
    );
  }

  if (!diagnostics) {
    return (
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-8 text-center space-y-3 shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-[#DBEAFE] text-[#2563EB]">
          <Activity className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-[#172033]">Website Health & Diagnostics</h4>
        <p className="text-xs text-[#526174] max-w-md mx-auto">
          Run a crawl or select a historical crawl session to view deterministic health scores, link analysis, and site diagnostics.
        </p>
      </div>
    );
  }

  const {
    health_score,
    health_status,
    total_pages,
    successful_pages,
    failed_pages,
    score_breakdown,
    status_distribution,
    link_statistics,
    depth_statistics,
    title_statistics,
    issues,
  } = diagnostics;

  // Determine score color theme
  const getScoreTheme = (score: number) => {
    if (score >= 90) return { text: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]', border: 'border-[#BBE5C8]', ring: 'stroke-[#16A34A]' };
    if (score >= 75) return { text: 'text-[#2563EB]', bg: 'bg-[#DBEAFE]', border: 'border-[#BFCFE0]', ring: 'stroke-[#2563EB]' };
    if (score >= 50) return { text: 'text-[#D97706]', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', ring: 'stroke-[#D97706]' };
    return { text: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', border: 'border-[#FCA5A5]', ring: 'stroke-[#DC2626]' };
  };

  const theme = getScoreTheme(health_score);

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Health Score & Key Metrics */}
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* Score & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-[#CBD8E6]">
          
          <div className="flex items-center gap-5">
            {/* Circular Health Score Wheel */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="stroke-[#D9E3EE]"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`${theme.ring} transition-all duration-1000 ease-out`}
                  strokeDasharray={`${health_score}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-black font-mono leading-none ${theme.text}`}>
                  {health_score}
                </span>
                <span className="text-[9px] font-mono text-[#718096] uppercase mt-0.5">/ 100</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#172033] leading-none">Website Health Score</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border uppercase ${theme.bg} ${theme.text} ${theme.border}`}>
                  {health_status}
                </span>
              </div>
              <p className="text-xs text-[#526174] mt-1">
                Deterministic crawl diagnostics for <span className="text-[#172033] font-mono font-semibold">{diagnostics.domain}</span>
              </p>
              
              {score_breakdown.length > 0 && (
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="mt-2 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1 transition-colors"
                >
                  <span>{showBreakdown ? 'Hide score breakdown' : 'Why this score?'}</span>
                  {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#172033] bg-[#EDF3F9] px-3 py-2 rounded-xl border border-[#CBD8E6]">
            <ShieldAlert className="w-4 h-4 text-[#2563EB] shrink-0" />
            <span>{issues.length} Diagnostic Issue(s) Detected</span>
          </div>

        </div>

        {/* Expandable Score Breakdown */}
        {showBreakdown && score_breakdown.length > 0 && (
          <div className="p-4 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl space-y-2 text-xs font-mono animate-fadeIn">
            <span className="text-[#718096] font-semibold uppercase tracking-wider text-[10px] block">
              Deduction Breakdown (Base: 100 Points)
            </span>
            <div className="divide-y divide-[#CBD8E6]">
              {score_breakdown.map((item, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between">
                  <span className="text-[#172033]">{item.reason}</span>
                  <span className="text-[#DC2626] font-bold">-{item.deduction} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <FileCheck className="w-3.5 h-3.5 text-[#2563EB]" /> Total Pages
            </div>
            <div className="text-lg font-bold font-mono text-[#172033] mt-1">{total_pages}</div>
          </div>

          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" /> Healthy (2xx)
            </div>
            <div className="text-lg font-bold font-mono text-[#16A34A] mt-1">{successful_pages}</div>
          </div>

          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" /> Broken Pages
            </div>
            <div className="text-lg font-bold font-mono text-[#DC2626] mt-1">{failed_pages}</div>
          </div>

          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <Link className="w-3.5 h-3.5 text-[#6366F1]" /> Internal Links
            </div>
            <div className="text-lg font-bold font-mono text-[#6366F1] mt-1">
              {link_statistics.total_internal_links}
            </div>
          </div>

          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <ExternalLink className="w-3.5 h-3.5 text-[#0891B2]" /> External Links
            </div>
            <div className="text-lg font-bold font-mono text-[#0891B2] mt-1">
              {link_statistics.total_external_links}
            </div>
          </div>

          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl">
            <div className="flex items-center gap-1.5 text-[#526174] text-xs font-medium">
              <FileWarning className="w-3.5 h-3.5 text-[#D97706]" /> Title Issues
            </div>
            <div className="text-lg font-bold font-mono text-[#D97706] mt-1">
              {title_statistics.missing_title_count + title_statistics.duplicate_title_count}
            </div>
          </div>

        </div>

      </div>

      {/* Middle Grid: HTTP Status Distribution & Depth Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* HTTP Status Breakdown */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider font-mono">
            HTTP Status Code Distribution
          </h4>

          <div className="space-y-2.5 font-mono text-xs">
            {/* 2xx */}
            <div>
              <div className="flex justify-between text-[#172033] text-xs mb-1">
                <span className="flex items-center gap-1.5 font-sans font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" /> 2xx Success (Healthy)
                </span>
                <span className="font-bold text-[#16A34A]">{status_distribution.count_2xx}</span>
              </div>
              <div className="w-full h-2 bg-[#E3ECF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#16A34A] rounded-full transition-all"
                  style={{ width: `${total_pages > 0 ? (status_distribution.count_2xx / total_pages) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 3xx */}
            <div>
              <div className="flex justify-between text-[#172033] text-xs mb-1">
                <span className="flex items-center gap-1.5 font-sans font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> 3xx Redirection
                </span>
                <span className="font-bold text-[#D97706]">{status_distribution.count_3xx}</span>
              </div>
              <div className="w-full h-2 bg-[#E3ECF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D97706] rounded-full transition-all"
                  style={{ width: `${total_pages > 0 ? (status_distribution.count_3xx / total_pages) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 4xx */}
            <div>
              <div className="flex justify-between text-[#172033] text-xs mb-1">
                <span className="flex items-center gap-1.5 font-sans font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> 4xx Client Error (Broken)
                </span>
                <span className="font-bold text-[#DC2626]">{status_distribution.count_4xx}</span>
              </div>
              <div className="w-full h-2 bg-[#E3ECF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#DC2626] rounded-full transition-all"
                  style={{ width: `${total_pages > 0 ? (status_distribution.count_4xx / total_pages) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 5xx */}
            <div>
              <div className="flex justify-between text-[#172033] text-xs mb-1">
                <span className="flex items-center gap-1.5 font-sans font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" /> 5xx Server Error
                </span>
                <span className="font-bold text-[#7C3AED]">{status_distribution.count_5xx}</span>
              </div>
              <div className="w-full h-2 bg-[#E3ECF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7C3AED] rounded-full transition-all"
                  style={{ width: `${total_pages > 0 ? (status_distribution.count_5xx / total_pages) * 100 : 0}%` }}
                />
              </div>
            </div>

          </div>

          {/* Exact Status Codes Tags */}
          <div className="pt-2 border-t border-[#CBD8E6] flex flex-wrap gap-1.5">
            {Object.entries(status_distribution.exact_status_counts).map(([code, count]) => (
              <span
                key={code}
                className="px-2 py-0.5 bg-[#EDF3F9] border border-[#CBD8E6] rounded font-mono text-[11px] text-[#172033]"
              >
                HTTP {code}: <strong className="text-[#172033]">{count}</strong>
              </span>
            ))}
          </div>

        </div>

        {/* Crawl Depth & Structure Analysis */}
        <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider font-mono">
              Depth & Hierarchy Analysis
            </h4>
            <span className="text-[11px] font-mono text-[#526174]">
              Avg Depth: {depth_statistics.average_depth}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            {Object.entries(depth_statistics.depth_counts).map(([d, count]) => (
              <div key={d} className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#526174] font-sans font-medium">
                  <Layers className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Depth {d}</span>
                </div>
                <span className="font-bold text-[#172033]">{count} page(s)</span>
              </div>
            ))}
          </div>

          {/* Unverified Links Notice */}
          <div className="p-3 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl text-xs space-y-1">
            <span className="text-[#172033] font-medium block">Link Verification Summary:</span>
            <div className="font-mono text-[11px] space-y-0.5 text-[#526174]">
              <p>• Verified OK internal links: <strong className="text-[#16A34A]">{link_statistics.verified_internal_ok}</strong></p>
              <p>• Verified broken internal links: <strong className="text-[#DC2626]">{link_statistics.verified_internal_broken}</strong></p>
              <p>• Unverified internal links (due to limits): <strong className="text-[#6366F1]">{link_statistics.unverified_internal}</strong></p>
              <p>• Unverified external links: <strong className="text-[#0891B2]">{link_statistics.unverified_external}</strong></p>
            </div>
          </div>

        </div>

      </div>

      {/* Issues & Warnings List */}
      <div className="bg-[#F5F8FC] border border-[#CBD8E6] rounded-2xl p-5 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#D97706]" />
          <span>Diagnostic Issues & Recommendations ({issues.length})</span>
        </h4>

        {issues.length === 0 ? (
          <div className="p-6 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl text-center text-xs text-[#526174] font-mono">
            No diagnostic issues detected! Website pages, title tags, and links are healthy.
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, idx) => {
              const isExpanded = expandedIssueIdx === idx;
              return (
                <div
                  key={idx}
                  className="p-3.5 bg-[#EDF3F9] border border-[#CBD8E6] rounded-xl text-xs space-y-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {issue.severity === 'error' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-[#FEE2E2] text-[#DC2626] border border-[#FCA5A5]">
                          Error
                        </span>
                      )}
                      {issue.severity === 'warning' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                          Warning
                        </span>
                      )}
                      {issue.severity === 'info' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-[#DBEAFE] text-[#2563EB] border border-[#BFCFE0]">
                          Info
                        </span>
                      )}
                      <span className="font-semibold text-[#172033]">{issue.category}</span>
                    </div>

                    {issue.affected_urls.length > 0 && (
                      <button
                        onClick={() => setExpandedIssueIdx(isExpanded ? null : idx)}
                        className="text-[11px] text-[#2563EB] hover:text-[#1D4ED8] font-mono flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide samples' : `View ${issue.affected_urls.length} sample(s)`}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  <p className="text-[#526174] font-sans">{issue.message}</p>

                  {/* Expandable Affected Sample URLs */}
                  {isExpanded && issue.affected_urls.length > 0 && (
                    <div className="p-2.5 bg-[#F5F8FC] border border-[#CBD8E6] rounded-lg space-y-1 font-mono text-[11px] text-[#526174] divide-y divide-[#CBD8E6]">
                      {issue.affected_urls.map((url, uIdx) => (
                        <div key={uIdx} className="pt-1 truncate" title={url}>
                          • {url}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
